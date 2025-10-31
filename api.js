// api/index.js
const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

// --- CONFIG ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.SESSION_SECRET || 'robotteam-default-secret-change-in-production';
const TOKEN_COOKIE_NAME = 'rt_token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const UPLOAD_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

// validate env
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_KEY not set. The API will fail on DB/storage calls.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const app = express();
app.use(express.json());

// multer memory storage (serverless-friendly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// helper: sign token
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// helper: verify token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// helper: set auth cookie
function setAuthCookie(res, token) {
  const cookieParts = [
    `${TOKEN_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Strict'
  ];
  if (IS_PRODUCTION) cookieParts.push('Secure');
  // Expires in 7 days:
  const expDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  cookieParts.push(`Expires=${expDate}`);
  // Path
  cookieParts.push('Path=/');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

// helper: clear cookie
function clearAuthCookie(res) {
  const cookieParts = [
    `${TOKEN_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  ];
  if (IS_PRODUCTION) cookieParts[0] = cookieParts[0].replace('; Path=/', '; Path=/; Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

// helper: get token from cookie header
function getTokenFromReq(req) {
  const header = req.headers.cookie || '';
  const match = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${TOKEN_COOKIE_NAME}=`));
  if (!match) return null;
  return match.split('=')[1];
}

// Middleware: populate req.user
async function authMiddleware(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    req.user = null;
    return next();
  }
  const payload = verifyToken(token);
  if (!payload || !payload.username) {
    req.user = null;
    return next();
  }
  // fetch latest user (in case isAdmin changed)
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', payload.username)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // ignore "no rows" message codes if needed
      req.user = null;
      return next();
    }

    if (!data) {
      req.user = null;
      return next();
    }

    req.user = {
      username: data.username,
      isAdmin: data.isadmin // note: lowercase/uppercase per SQL below
    };
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

app.use(authMiddleware);

// requireAuth/requireAdmin
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekiyor' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
  next();
}

// ========= Utility DB functions =========

// create initial data if needed: we will create default users if users table is empty
async function ensureInitialData() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('ensureInitialData - supabase error check users:', error);
      return;
    }
    if (Array.isArray(data) && data.length === 0) {
      // insert default users (keeping same plaintext passwords for compatibility)
      await supabase.from('users').insert([
        { username: 'serdal', password: 'serdal43', isadmin: true, hidden: false },
        { username: 'aslı', password: 'aslı43', isadmin: true, hidden: false },
        { username: 'nazım', password: 'nazım43', isadmin: true, hidden: false },
        { username: '0000', password: '', isadmin: true, hidden: true }
      ]);
      console.log('Inserted initial default users into Supabase.');
    }
  } catch (err) {
    console.error('ensureInitialData error:', err);
  }
}

// call ensureInitialData in background (non-blocking)
ensureInitialData();

// ========= ROUTES (converted from original) =========

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof password === 'undefined') return res.json({ success: false, message: 'Eksik bilgiler' });

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .limit(1)
    .single();

  if (error || !data) {
    return res.json({ success: false, message: 'Kullanıcı adı veya şifre yanlış' });
  }

  // Note: passwords stored plain to preserve compatibility with your old system
  if (data.password !== password) {
    return res.json({ success: false, message: 'Kullanıcı adı veya şifre yanlış' });
  }

  // sign token
  const token = signToken({ username: data.username });
  setAuthCookie(res, token);

  res.json({ success: true, isAdmin: data.isadmin || false, username: data.username });
});

// SESSION CHECK
app.get('/api/session', (req, res) => {
  if (req.user) {
    return res.json({ authenticated: true, username: req.user.username, isAdmin: req.user.isAdmin || false });
  }
  res.json({ authenticated: false });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Çıkış yapıldı' });
});

// GET USERS (admin only) - exclude hidden
app.get('/api/users', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('username,isadmin,hidden');

  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  const userList = (data || [])
    .filter(u => !u.hidden)
    .map(u => ({ username: u.username, isAdmin: u.isadmin }));

  res.json(userList);
});

// ADD USER (admin)
app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.json({ success: false, message: 'Kullanıcı adı gerekli' });

  const { data: existing } = await supabase.from('users').select('id').eq('username', username).limit(1);
  if (existing && existing.length) return res.json({ success: false, message: 'Bu kullanıcı adı zaten var' });

  const { error } = await supabase.from('users').insert([{ username, password: password || '', isadmin: false, hidden: false }]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Kullanıcı eklendi' });
});

// DELETE USER (admin) - cannot delete admin users
app.delete('/api/users/:username', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { data, error } = await supabase.from('users').select('isadmin').eq('username', username).limit(1).single();
  if (error || !data) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });

  if (data.isadmin) return res.json({ success: false, message: 'Admin kullanıcılar silinemez' });

  const { error: delErr } = await supabase.from('users').delete().eq('username', username);
  if (delErr) return res.status(500).json({ success: false, message: 'DB error', error: delErr });

  res.json({ success: true, message: 'Kullanıcı silindi' });
});

// PROMOTE
app.post('/api/users/:username/promote', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { data } = await supabase.from('users').select('isadmin').eq('username', username).limit(1).single();
  if (!data) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });
  if (data.isadmin) return res.json({ success: false, message: 'Kullanıcı zaten admin' });

  const { error } = await supabase.from('users').update({ isadmin: true }).eq('username', username);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Kullanıcı admin yapıldı' });
});

// DEMOTE
app.post('/api/users/:username/demote', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { data } = await supabase.from('users').select('isadmin').eq('username', username).limit(1).single();
  if (!data) return res.json({ success: false, message: 'Kullanıcı bulunamadı' });
  if (!data.isadmin) return res.json({ success: false, message: 'Kullanıcı zaten normal kullanıcı' });

  const { error } = await supabase.from('users').update({ isadmin: false }).eq('username', username);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Kullanıcı normal kullanıcı yapıldı' });
});

// TIMES - get for a robot
app.get('/api/times/:robot', async (req, res) => {
  const robot = req.params.robot;
  const { data, error } = await supabase.from('times').select('*').eq('robot', robot).order('id', { ascending: true });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// GET ALL TIMES
app.get('/api/times', async (req, res) => {
  const { data, error } = await supabase.from('times').select('*').order('id', { ascending: true });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  // convert settings from json if needed
  res.json(data || []);
});

// ADD TIME (auth)
app.post('/api/times', requireAuth, async (req, res) => {
  const { robot, time } = req.body || {};
  if (!robot || typeof time === 'undefined') return res.json({ success: false, message: 'Eksik bilgiler' });

  // fetch robot settings
  const { data: rs } = await supabase.from('robot_settings').select('*').eq('robot', robot).limit(1).single();
  const settings = rs ? { speed: rs.speed || '', kp: rs.kp || '', kd: rs.kd || '' } : { speed: '', kp: '', kd: '' };

  const insertObj = {
    robot,
    time: String(time),
    username: req.user.username,
    date: new Date().toLocaleString('tr-TR'),
    settings
  };

  const { error } = await supabase.from('times').insert([insertObj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Süre kaydedildi' });
});

// DELETE TIME (admin)
app.delete('/api/times/:robot/:id', requireAdmin, async (req, res) => {
  const { robot, id } = req.params;
  const { error } = await supabase.from('times').delete().eq('id', id).eq('robot', robot);
  if (error) return res.json({ success: false, message: 'Süre bulunamadı veya DB error', error });
  res.json({ success: true, message: 'Süre silindi' });
});

// CHANGE PASSWORD
app.post('/api/change-password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.json({ success: false, message: 'Eksik bilgiler' });

  const username = req.user.username;
  const { data } = await supabase.from('users').select('password').eq('username', username).limit(1).single();
  if (!data || data.password !== oldPassword) return res.json({ success: false, message: 'Eski şifre yanlış' });

  const { error } = await supabase.from('users').update({ password: newPassword }).eq('username', username);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
});

// ROBOT SETTINGS GET
app.get('/api/robot-settings/:robot', requireAuth, async (req, res) => {
  const robot = req.params.robot;
  const { data } = await supabase.from('robot_settings').select('*').eq('robot', robot).limit(1).single();
  if (!data) return res.json({ speed: '', kp: '', kd: '' });
  res.json({ speed: data.speed || '', kp: data.kp || '', kd: data.kd || '' });
});

// ROBOT SETTINGS SAVE (admin)
app.post('/api/robot-settings', requireAdmin, async (req, res) => {
  const { robot, speed, kp, kd } = req.body || {};
  if (!robot) return res.json({ success: false, message: 'Robot adı gerekli' });

  // upsert
  const { error } = await supabase.from('robot_settings').upsert([{ robot, speed: speed || '', kp: kp || '', kd: kd || '' }], { onConflict: ['robot'] });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Robot ayarları kaydedildi' });
});

// VIDEOS GET
app.get('/api/videos', async (req, res) => {
  const { data, error } = await supabase.from('videos').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// VIDEO UPLOAD (admin) - form field 'video'
app.post('/api/videos', requireAdmin, upload.single('video'), async (req, res) => {
  const { title, description } = req.body || {};
  if (!req.file) return res.json({ success: false, message: 'Video dosyası seçilmedi' });

  const ext = path.extname(req.file.originalname) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const key = `videos/${filename}`;

  // upload to supabase storage
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(key, req.file.buffer, { contentType: req.file.mimetype, cacheControl: '3600' });

  if (uploadErr) {
    console.error('Supabase upload error:', uploadErr);
    return res.status(500).json({ success: false, message: 'Dosya yükleme hatası', error: uploadErr });
  }

  // get public URL (if bucket is public) or create signed URL
  const { publicURL } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(key);
  let fileUrl = publicURL;
  // if bucket is private, you might instead create a signed URL per request
  // const { signedURL, error: signedErr } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUrl(key, 60 * 60 * 24 * 7);

  // insert metadata
  const insertObj = {
    title: title || 'Başlıksız Video',
    description: description || '',
    filename,
    path: key,
    url: fileUrl,
    uploaddate: new Date().toLocaleString('tr-TR'),
    uploadedby: req.user.username
  };

  const { error } = await supabase.from('videos').insert([insertObj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Video eklendi' });
});

// VIDEO DELETE (admin)
app.delete('/api/videos/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('videos').select('*').eq('id', id).limit(1).single();
  if (error || !data) return res.json({ success: false, message: 'Video bulunamadı' });

  // delete from storage
  if (data.path) {
    const { error: remErr } = await supabase.storage.from(UPLOAD_BUCKET).remove([data.path]);
    if (remErr) console.warn('Failed to remove file from storage', remErr);
  }

  const { error: delErr } = await supabase.from('videos').delete().eq('id', id);
  if (delErr) return res.status(500).json({ success: false, message: 'DB error', error: delErr });

  res.json({ success: true, message: 'Video silindi' });
});

// PHOTOS GET
app.get('/api/photos', async (req, res) => {
  const { data, error } = await supabase.from('photos').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// PHOTO UPLOAD (admin) - form field 'photo'
app.post('/api/photos', requireAdmin, upload.single('photo'), async (req, res) => {
  const { title, description } = req.body || {};
  if (!req.file) return res.json({ success: false, message: 'Fotoğraf dosyası seçilmedi' });

  const ext = path.extname(req.file.originalname) || '';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const key = `photos/${filename}`;

  const { data: uploadData, error: uploadErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(key, req.file.buffer, { contentType: req.file.mimetype, cacheControl: '3600' });
  if (uploadErr) {
    console.error('Supabase upload error:', uploadErr);
    return res.status(500).json({ success: false, message: 'Dosya yükleme hatası', error: uploadErr });
  }

  const { publicURL } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(key);
  const fileUrl = publicURL;

  const insertObj = {
    title: title || 'Başlıksız Fotoğraf',
    description: description || '',
    filename,
    path: key,
    url: fileUrl,
    uploaddate: new Date().toLocaleString('tr-TR'),
    uploadedby: req.user.username
  };

  const { error } = await supabase.from('photos').insert([insertObj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Fotoğraf eklendi' });
});

// PHOTO DELETE (admin)
app.delete('/api/photos/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { data, error } = await supabase.from('photos').select('*').eq('id', id).limit(1).single();
  if (error || !data) return res.json({ success: false, message: 'Fotoğraf bulunamadı' });

  if (data.path) {
    const { error: remErr } = await supabase.storage.from(UPLOAD_BUCKET).remove([data.path]);
    if (remErr) console.warn('Failed to remove file from storage', remErr);
  }

  const { error: delErr } = await supabase.from('photos').delete().eq('id', id);
  if (delErr) return res.status(500).json({ success: false, message: 'DB error', error: delErr });

  res.json({ success: true, message: 'Fotoğraf silindi' });
});

// ANNOUNCEMENTS GET
app.get('/api/announcements', async (req, res) => {
  const { data, error } = await supabase.from('announcements').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// ANNOUNCEMENT ADD (admin)
app.post('/api/announcements', requireAdmin, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.json({ success: false, message: 'Başlık ve içerik gerekli' });

  const obj = {
    title,
    content,
    date: new Date().toLocaleString('tr-TR'),
    createdby: req.user.username
  };

  const { error } = await supabase.from('announcements').insert([obj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Duyuru eklendi' });
});

// ANNOUNCEMENT DELETE (admin)
app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return res.json({ success: false, message: 'Duyuru bulunamadı veya DB error', error });
  res.json({ success: true, message: 'Duyuru silindi' });
});

// NOTES GET (auth)
app.get('/api/notes', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('notes').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// NOTE ADD (auth)
app.post('/api/notes', requireAuth, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content) return res.json({ success: false, message: 'Başlık ve içerik boş olamaz' });

  const obj = {
    title,
    content,
    date: new Date().toLocaleString('tr-TR'),
    createdby: req.user.username
  };

  const { error } = await supabase.from('notes').insert([obj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Not eklendi' });
});

// NOTE DELETE (admin)
app.delete('/api/notes/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return res.status(500).json({ success: false, message: 'Not bulunamadı veya DB error', error });
  res.json({ success: true, message: 'Not silindi' });
});

// NOTE UPDATE (owner or admin)
app.put('/api/notes/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { title, content } = req.body || {};
  if (!title || !content) return res.json({ success: false, message: 'Başlık ve içerik boş olamaz' });

  const { data, error } = await supabase.from('notes').select('*').eq('id', id).limit(1).single();
  if (error || !data) return res.json({ success: false, message: 'Not bulunamadı' });

  if (data.createdby !== req.user.username && !req.user.isAdmin) {
    return res.json({ success: false, message: 'Bu notu düzenleme yetkiniz yok' });
  }

  const { error: updErr } = await supabase.from('notes').update({ title, content, lastmodified: new Date().toLocaleString('tr-TR') }).eq('id', id);
  if (updErr) return res.status(500).json({ success: false, message: 'DB error', error: updErr });

  res.json({ success: true, message: 'Not güncellendi' });
});

// ADMIN MESSAGES GET (public)
app.get('/api/admin-messages', async (req, res) => {
  const { data, error } = await supabase.from('admin_messages').select('*').order('id', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  res.json(data || []);
});

// ADMIN MESSAGE ADD (admin)
app.post('/api/admin-messages', requireAdmin, async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.json({ success: false, message: 'Mesaj içeriği boş olamaz' });

  const obj = { message, date: new Date().toLocaleString('tr-TR'), sentby: req.user.username };
  const { error } = await supabase.from('admin_messages').insert([obj]);
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });

  res.json({ success: true, message: 'Mesaj gönderildi' });
});

// ADMIN MESSAGE DELETE (admin)
app.delete('/api/admin-messages/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('admin_messages').delete().eq('id', id);
  if (error) return res.status(500).json({ success: false, message: 'Mesaj bulunamadı veya DB error', error });
  res.json({ success: true, message: 'Mesaj silindi' });
});

// Serve static files (index.html etc.) from project root when requested (Vercel handles routing too).
// For safety, do not expose sensitive files from project root. We'll implement a basic static serve for public assets if needed.
const static = require('express').static;
app.use(express.static(path.join(process.cwd(), 'public')));

// Fallback
app.get('/', (req, res) => {
  res.send('RobotTeam API (Supabase-backed) — use /api/* endpoints');
});

// Export for serverless
module.exports = app;
module.exports.handler = serverless(app);
