'use strict';

const express   = require('express');
const session   = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt    = require('bcrypt');
const path      = require('path');
const fs        = require('fs');
const crypto    = require('crypto');

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR  = process.env.UPLOAD_DIR || '/app/uploads';
const TMP_DIR     = path.join(UPLOAD_DIR, '.tmp');
const SESSION_DIR = path.join(UPLOAD_DIR, '.sessions'); // inside volume → survives rebuilds
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PORT           = process.env.PORT || 3000;

const AUTH_EMAIL    = process.env.AUTH_EMAIL    || 'otabekjurabekov3@gmail.com';
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH
  || '$2b$12$T2vc8dvlbNbfuwt1.4UN1OaZkGVuKKAvRFnkySdov7GtU3Q88fUIC';

fs.mkdirSync(UPLOAD_DIR,  { recursive: true });
fs.mkdirSync(TMP_DIR,     { recursive: true });
fs.mkdirSync(SESSION_DIR, { recursive: true });

// Clean up abandoned tmp dirs older than 24 h on startup
try {
  fs.readdirSync(TMP_DIR).forEach(name => {
    const d = path.join(TMP_DIR, name);
    const age = Date.now() - fs.statSync(d).mtimeMs;
    if (age > 24 * 60 * 60 * 1000) fs.rmSync(d, { recursive: true, force: true });
  });
} catch (_) {}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new FileStore({ path: SESSION_DIR, ttl: 7 * 24 * 3600, retries: 0, logFn: () => {} }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth ──────────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Session expired' });
  res.redirect('/?error=session');
}

// ── Pages ─────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.send('OK'));

app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.redirect('/?error=missing');
  try {
    const ok = email.trim().toLowerCase() === AUTH_EMAIL.toLowerCase()
            && await bcrypt.compare(password, PASSWORD_HASH);
    if (ok) { req.session.authenticated = true; return res.redirect('/dashboard'); }
    res.redirect('/?error=invalid');
  } catch (e) { res.redirect('/?error=server'); }
});

app.post('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// ── File list ─────────────────────────────────────────────────────────────────
app.get('/api/files', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => !f.endsWith('.meta') && f !== '.tmp' && f !== '.sessions')
      .map(stored => {
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(path.join(UPLOAD_DIR, stored + '.meta'), 'utf8')); } catch (_) {}
        const stats = fs.statSync(path.join(UPLOAD_DIR, stored));
        return { id: stored, originalname: meta.originalname || stored, size: stats.size, uploaded: meta.uploaded || stats.birthtime };
      })
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    res.json(files);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Chunked upload ────────────────────────────────────────────────────────────
// Each chunk: POST /api/chunk?uploadId=X&index=N&total=N&name=filename.ext
// Body: raw binary (application/octet-stream)
// Final chunk triggers assembly → user sees one file.

app.post('/api/chunk', requireAuth, (req, res) => {
  const { uploadId, index, total, name } = req.query;
  const idx   = parseInt(index,  10);
  const count = parseInt(total,  10);

  if (!uploadId || isNaN(idx) || isNaN(count) || !name) {
    return res.status(400).json({ error: 'Missing params' });
  }

  // Sanitise upload ID so it can't escape the tmp dir
  const safeId  = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  const chunkDir = path.join(TMP_DIR, safeId);
  fs.mkdirSync(chunkDir, { recursive: true });

  const chunkPath = path.join(chunkDir, `chunk-${idx}`);
  const writer    = fs.createWriteStream(chunkPath);

  req.on('error', err => { console.error('Chunk req error:', err); res.status(500).json({ error: err.message }); });
  writer.on('error', err => { console.error('Chunk write error:', err); res.status(500).json({ error: err.message }); });

  req.pipe(writer);

  writer.on('finish', async () => {
    // Count chunks written so far
    let written;
    try { written = fs.readdirSync(chunkDir).filter(f => f.startsWith('chunk-')).length; }
    catch (_) { written = 0; }

    if (written < count) {
      // Not done yet — just acknowledge this chunk
      return res.json({ done: false, received: written, total: count });
    }

    // All chunks received → assemble into final file
    try {
      const ext    = path.extname(name) || '';
      const base   = path.basename(name, ext).replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 200);
      const stored = Date.now() + '_' + base + ext;
      const dest   = path.join(UPLOAD_DIR, stored);

      await assembleChunks(chunkDir, dest, count);

      const size = fs.statSync(dest).size;
      fs.writeFileSync(dest + '.meta', JSON.stringify({ originalname: name, uploaded: new Date().toISOString(), size }));
      fs.rmSync(chunkDir, { recursive: true, force: true });

      console.log(`Assembled ${stored} (${(size / 1e9).toFixed(2)} GB)`);
      res.json({ done: true, id: stored });

    } catch (e) {
      console.error('Assembly error:', e);
      res.status(500).json({ error: 'Assembly failed: ' + e.message });
    }
  });
});

function assembleChunks(chunkDir, dest, totalChunks) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(dest);
    let i = 0;

    function pipeNext() {
      if (i === totalChunks) { writer.end(); return; }
      const src = fs.createReadStream(path.join(chunkDir, `chunk-${i++}`));
      src.on('error', reject);
      src.pipe(writer, { end: false });
      src.on('end', pipeNext);
    }

    writer.on('finish', resolve);
    writer.on('error', reject);
    pipeNext();
  });
}

// ── Cancel / clean up an in-progress upload ───────────────────────────────────
app.delete('/api/chunk/:uploadId', requireAuth, (req, res) => {
  const safeId   = req.params.uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  const chunkDir = path.join(TMP_DIR, safeId);
  try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch (_) {}
  res.json({ cancelled: true });
});

// ── Download ──────────────────────────────────────────────────────────────────
app.get('/api/download/:id', requireAuth, (req, res) => {
  const id   = path.basename(req.params.id);
  const file = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });

  let originalname = id;
  try { originalname = JSON.parse(fs.readFileSync(file + '.meta', 'utf8')).originalname || id; } catch (_) {}

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalname)}`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', fs.statSync(file).size);

  const stream = fs.createReadStream(file);
  stream.on('error', err => { if (!res.headersSent) res.status(500).end(); });
  stream.pipe(res);
});

// ── Delete ────────────────────────────────────────────────────────────────────
app.delete('/api/files/:id', requireAuth, (req, res) => {
  const id   = path.basename(req.params.id);
  const file = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  try {
    fs.unlinkSync(file);
    try { fs.unlinkSync(file + '.meta'); } catch (_) {}
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => !f.endsWith('.meta') && f !== '.tmp' && f !== '.sessions');
    const total = files.reduce((s, f) => { try { return s + fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch(_){return s;} }, 0);
    res.json({ count: files.length, totalBytes: total });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => console.log(`FileDrop on port ${PORT} | uploads: ${UPLOAD_DIR}`));
server.setTimeout(6 * 60 * 60 * 1000);
server.keepAliveTimeout = 6 * 60 * 60 * 1000;
