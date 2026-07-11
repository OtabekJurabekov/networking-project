'use strict';

const express = require('express');
const session = require('express-session');
const bcrypt  = require('bcrypt');
const busboy  = require('busboy');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app = express();

// ── Config ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR     = process.env.UPLOAD_DIR || '/app/uploads';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const PORT           = process.env.PORT || 3000;

// Credentials — bcrypt hash is safe to store; cannot be reversed to plaintext.
// Override via env vars for flexibility.
const AUTH_EMAIL    = process.env.AUTH_EMAIL    || 'otabekjurabekov3@gmail.com';
const PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH
  || '$2b$12$T2vc8dvlbNbfuwt1.4UN1OaZkGVuKKAvRFnkySdov7GtU3Q88fUIC';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/?error=session');
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.send('OK'));

// Login page → dashboard redirect if already logged in
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.redirect('/?error=missing');
  try {
    const emailOk    = email.trim().toLowerCase() === AUTH_EMAIL.toLowerCase();
    const passwordOk = await bcrypt.compare(password, PASSWORD_HASH);
    if (emailOk && passwordOk) {
      req.session.authenticated = true;
      return res.redirect('/dashboard');
    }
    res.redirect('/?error=invalid');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/?error=server');
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── File list ─────────────────────────────────────────────────────────────────
app.get('/api/files', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => !f.endsWith('.meta'))
      .map(stored => {
        const metaPath = path.join(UPLOAD_DIR, stored + '.meta');
        let meta = {};
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}
        const stats = fs.statSync(path.join(UPLOAD_DIR, stored));
        return {
          id:           stored,
          originalname: meta.originalname || stored,
          size:         stats.size,
          uploaded:     meta.uploaded || stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Upload (streaming — no memory buffering) ──────────────────────────────────
app.post('/api/upload', requireAuth, (req, res) => {
  const bb = busboy({
    headers: req.headers,
    limits: { fileSize: 15 * 1024 * 1024 * 1024 } // 15 GB hard cap
  });

  // Track the write-to-disk promise so we can await it before responding.
  // Busboy's 'finish' fires when parsing is done, but the disk writer may
  // still be flushing — we must wait for 'finish' on the writer itself.
  let writePromise = null;
  let uploadError  = null;

  bb.on('file', (fieldname, fileStream, info) => {
    const { filename } = info;
    const ext    = path.extname(filename) || '';
    const base   = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    const stored = Date.now() + '_' + base + ext;
    const dest   = path.join(UPLOAD_DIR, stored);
    const meta   = { originalname: filename, uploaded: new Date().toISOString() };

    const writer = fs.createWriteStream(dest);

    fileStream.on('limit', () => {
      uploadError = 'File exceeds 15 GB limit';
      fileStream.resume();
      writer.destroy();
      try { fs.unlinkSync(dest); } catch (_) {}
    });

    fileStream.pipe(writer);

    // Wrap the disk write in a promise so we can await completion
    writePromise = new Promise((resolve, reject) => {
      writer.on('finish', () => {
        if (uploadError) return resolve(null);
        try {
          meta.size = fs.statSync(dest).size;
          fs.writeFileSync(dest + '.meta', JSON.stringify(meta));
        } catch (e) { return reject(e); }
        resolve(stored);
      });
      writer.on('error', err => {
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(err);
      });
    });
  });

  bb.on('error', err => { uploadError = err.message; });

  // Use 'finish' (not 'close') — fires when busboy has finished parsing.
  // Then await the disk write promise before sending the response.
  bb.on('finish', async () => {
    if (uploadError) return res.status(500).json({ error: uploadError });
    if (!writePromise) return res.status(400).json({ error: 'No file received' });
    try {
      const saved = await writePromise;
      if (!saved) return res.status(500).json({ error: uploadError || 'Write failed' });
      res.json({ success: true, id: saved });
    } catch (err) {
      console.error('Upload write error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(bb);
});

// ── Download ──────────────────────────────────────────────────────────────────
app.get('/api/download/:id', requireAuth, (req, res) => {
  const id   = path.basename(req.params.id); // prevent path traversal
  const file = path.join(UPLOAD_DIR, id);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });

  let originalname = id;
  try {
    const meta = JSON.parse(fs.readFileSync(file + '.meta', 'utf8'));
    originalname = meta.originalname || id;
  } catch (_) {}

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalname)}`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', fs.statSync(file).size);

  const stream = fs.createReadStream(file);
  stream.on('error', err => {
    console.error('Download stream error:', err);
    if (!res.headersSent) res.status(500).end();
  });
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Storage stats ─────────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => !f.endsWith('.meta'));
    const total = files.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch (_) { return sum; }
    }, 0);
    res.json({ count: files.length, totalBytes: total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`FileDrop running on port ${PORT}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
});

// Long timeout for huge file uploads (6 hours)
server.setTimeout(6 * 60 * 60 * 1000);
server.keepAliveTimeout = 6 * 60 * 60 * 1000;
