// migrate_uploads_to_supabase.js
// Node script to upload local files (uploads/*) to Supabase storage and update DB video/photo rows with public URL.
// Usage: set env vars SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET
// Then run: node migrate_uploads_to_supabase.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function uploadFile(localPath, destKey) {
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(destKey, buffer, {
    contentType: getContentType(localPath),
    upsert: false
  });
  if (error) throw error;
  const { publicURL } = supabase.storage.from(BUCKET).getPublicUrl(destKey);
  return publicURL;
}

function getContentType(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

async function migrateVideos() {
  // Fetch videos rows (that have path but maybe no url)
  const { data: videos, error } = await supabase.from('videos').select('id, path, url').limit(1000);
  if (error) throw error;
  for (const v of videos) {
    if (!v.path) continue;
    // local path expected: ./uploads/...  -> try to find file
    const localPath = path.join(process.cwd(), v.path);
    if (!fs.existsSync(localPath)) {
      console.warn('Local file not found:', localPath, ' — skipping');
      continue;
    }
    const destKey = v.path; // keep same key e.g. "videos/xxx.mp4" or "uploads/videos/..."
    // sanitize key: if v.path starts with 'uploads/', remove leading 'uploads/' because bucket root is uploads bucket
    let key = destKey;
    if (key.startsWith('uploads/')) key = key.replace(/^uploads\//, '');
    try {
      console.log('Uploading', localPath, '->', key);
      const publicUrl = await uploadFile(localPath, key);
      // update DB row with url (and optionally path)
      const { error: updErr } = await supabase.from('videos').update({ url: publicUrl, path: key }).eq('id', v.id);
      if (updErr) {
        console.error('DB update error for id', v.id, updErr);
      } else {
        console.log('Updated DB id', v.id);
      }
    } catch (err) {
      console.error('Upload error for', localPath, err);
    }
  }
}

async function migratePhotos() {
  const { data: photos, error } = await supabase.from('photos').select('id, path, url').limit(1000);
  if (error) throw error;
  for (const p of photos) {
    if (!p.path) continue;
    const localPath = path.join(process.cwd(), p.path);
    if (!fs.existsSync(localPath)) {
      console.warn('Local file not found:', localPath, ' — skipping');
      continue;
    }
    let key = p.path;
    if (key.startsWith('uploads/')) key = key.replace(/^uploads\//, '');
    try {
      console.log('Uploading', localPath, '->', key);
      const publicUrl = await uploadFile(localPath, key);
      const { error: updErr } = await supabase.from('photos').update({ url: publicUrl, path: key }).eq('id', p.id);
      if (updErr) console.error('DB update error for id', p.id, updErr);
      else console.log('Updated DB id', p.id);
    } catch (err) {
      console.error('Upload error for', localPath, err);
    }
  }
}

(async () => {
  try {
    await migrateVideos();
    await migratePhotos();
    console.log('Migration done.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
})();
