// api/index.js
// Full converted API: Express (CommonJS) + serverless + Supabase + multer (memory uploads) + JWT cookie auth
// Place as /api/index.js and deploy to Vercel. Set env vars: SUPABASE_URL, SUPABASE_KEY (service role), SESSION_SECRET, SUPABASE_BUCKET

const express = require('express');
const serverless = require('serverless-http');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');

// CONFIG (from env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // service_role recommended
const JWT_SECRET = process.env.SESSION_SECRET || 'robotteam-default-secret-change-in-production';
const TOKEN_COOKIE_NAME = 'rt_token';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const UPLOAD_BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

// Validate env minimally
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_KEY not set. DB/storage calls will fail.');
}

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const app = express();
app.use(express.json());

// multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Helper: JWT sign/verify and cookie
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}
function setAuthCookie(res, token) {
  const parts = [
    `${TOKEN_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/'
  ];
  if (IS_PRODUCTION) parts.push('Secure');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  parts.push(`Expires=${expires}`);
  res.setHeader('Set-Cookie', parts.join('; '));
}
function clearAuthCookie(res) {
  const parts = [`${TOKEN_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`];
  if (IS_PRODUCTION) parts[0] = parts[0].replace('; Path=/', '; Path=/; Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function getTokenFromReq(req) {
  const header = req.headers.cookie || '';
  const parts = header.split(';').map(s => s.trim());
  const match = parts.find(s => s.startsWith(`${TOKEN_COOKIE_NAME}=`));
  if (!match) return null;
  return match.split('=')[1];
}

// Auth middleware populates req.user from token and database (latest isAdmin flag)
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
  try {
    const { data, error } = await supabase.from('users').select('*').eq('username', payload.username).limit(1).single();
    if (error || !data) {
      req.user = null;
      return next();
    }
    req.user = { username: data.username, isAdmin: !!data.isadmin };
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

app.use(authMiddleware);

// requireAuth/requireAdmin helpers
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Giriş yapmanız gerekiyor' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok' });
  next();
}

// Ensure initial default users exist (non-blocking)
async function ensureInitialData() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) return;
    if (Array.isArray(data) && data.length === 0) {
      await supabase.from('users').insert([
        { username: 'serdal', password: 'serdal43', isadmin: true, hidden: false },
        { username: 'aslı', password: 'aslı43', isadmin: true, hidden: false },
        { username: 'nazım', password: 'nazım43', isadmin: true, hidden: false },
        { username: '0000', password: '', isadmin: true, hidden: true }
      ]);
      console.log('Inserted initial default users into Supabase.');
    }
  } catch (err) {
    console.warn('ensureInitialData error', err);
  }
}
ensureInitialData();

// ========== ROUTES ==========

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || typeof password === 'undefined') return res.json({ success: false, message: 'Eksik bilgiler' });

  const { data, error } = await supabase.from('users').select('*').eq('username', username).limit(1).single();
  if (error || !data) return res.json({ success: false, message: 'Kullanıcı adı veya şifre yanlış' });

  // current system uses plain-text passwords for compatibility
  if (data.password !== password) return res.json({ success: false, message: 'Kullanıcı adı veya şifre yanlış' });

  const token = signToken({ username: data.username });
  setAuthCookie(res, token);
  res.json({ success: true, isAdmin: !!data.isadmin, username: data.username });
});

// SESSION
app.get('/api/session', (req, res) => {
  if (req.user) return res.json({ authenticated: true, username: req.user.username, isAdmin: req.user.isAdmin || false });
  res.json({ authenticated: false });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Çıkış yapıldı' });
});

// USERS: list (admin, exclude hidden)
app.get('/api/users', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('users').select('username,isadmin,hidden');
  if (error) return res.status(500).json({ success: false, message: 'DB error', error });
  const list = (data || []).filter(u => !u.hidden).map(u => ({ username: u.username, isAdmin: u.isadmin }));
  res.json(list);
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
  res.json(data || []);
});

// ADD TIME (auth)
app.post('/api/times', requireAuth, async (req, res) => {
  const { robot, time } = req.body || {};
  if (!robot || typeof time === 'undefined') return res.json({ success: false, message: 'Eksik bilgiler' });

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
  const { id } = req.params;
  const { error } = await supabase.from('times').delete().eq('id', id);
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
  // store under videos/filename in bucket root
  const key = `videos/${filename}`;

  const { error: uploadErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(key, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
    cacheControl: '3600'
  });

  if (uploadErr) {
    console.error('Supabase upload error:', uploadErr);
    return res.status(500).json({ success: false, message: 'Dosya yükleme hatası', error: uploadErr });
  }

  const { publicURL } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(key);
  const fileUrl = publicURL;

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

  const { error: uploadErr } = await supabase.storage.from(UPLOAD_BUCKET).upload(key, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
    cacheControl: '3600'
  });

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

  const obj = { title, content, date: new Date().toLocaleString('tr-TR'), createdby: req.user.username };
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

  const obj = { title, content, date: new Date().toLocaleString('tr-TR'), createdby: req.user.username };
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

  if (data.createdby !== req.user.username && !req.user.isAdmin) return res.json({ success: false, message: 'Bu notu düzenleme yetkiniz yok' });

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

// Basic static serve route for public files (Vercel will handle this too)
app.use(express.static(path.join(process.cwd(), 'public')));

// Root
app.get('/', (req, res) => {
  res.send('RobotTeam API (Supabase-backed). Use /api/* endpoints.');
});

// Export for serverless
module.exports = app;
module.exports.handler = serverless(app);
