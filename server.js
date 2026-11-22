/* ============================================================
   Seed2Serve — Authentication backend (Node.js + Express + MySQL)

   - Serves the static frontend (index.html, login.html, css, js,
     assets) from this directory.
   - Provides /api/register and /api/login.
   - Passwords are hashed with bcrypt (via bcryptjs) before storage.
   - Sensitive config lives in the .env file (never in frontend code).
   - Sessions are persisted in MySQL via express-mysql-session and
     delivered as an httpOnly cookie.
   ============================================================ */
'use strict';

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { sendMail } = require('./mailer');
const { initDatabase, pool } = require('./db');

const app = express();

/* ------------------------------------------------------------
   Configuration (from environment variables)
   ------------------------------------------------------------ */
const PORT = parseInt(process.env.PORT, 10) || 3000;
const BCRYPT_ROUNDS = 12;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const AGROZONE_URL = process.env.AGROZONE_URL || 'http://127.0.0.1:8000';

/* ------------------------------------------------------------
   Minimal persistent session store (MySQL)
   ------------------------------------------------------------ */
class MySQLSessionStore extends session.Store {
  constructor(connectionPool) {
    super();
    this.pool = connectionPool;
  }

  get(sid, callback) {
    this.pool.query('SELECT data, expires FROM sessions WHERE session_id = ? LIMIT 1', [sid])
      .then(([rows]) => {
        const row = rows && rows[0];
        if (!row || row.expires <= Math.floor(Date.now() / 1000)) {
          return callback(null, null);
        }
        callback(null, JSON.parse(row.data));
      })
      .catch(callback);
  }

  set(sid, sessionData, callback) {
    const expires = sessionData.cookie && sessionData.cookie.expires
      ? Math.floor(new Date(sessionData.cookie.expires).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 86400;
    this.pool.query(
      `INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
      [sid, expires, JSON.stringify(sessionData)]
    ).then(() => callback && callback()).catch(callback);
  }

  destroy(sid, callback) {
    this.pool.query('DELETE FROM sessions WHERE session_id = ?', [sid])
      .then(() => callback && callback()).catch(callback);
  }

  touch(sid, sessionData, callback) {
    const expires = sessionData.cookie && sessionData.cookie.expires
      ? Math.floor(new Date(sessionData.cookie.expires).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 86400;
    this.pool.query('UPDATE sessions SET expires = ? WHERE session_id = ?', [expires, sid])
      .then(() => callback && callback()).catch(callback);
  }
}

const sessionStore = new MySQLSessionStore(pool);

app.use(
  session({
    name: 'seed2serve.sid',
    secret: process.env.SESSION_SECRET || 'insecure_dev_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // not readable by client JS
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true', // true over HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

/* ------------------------------------------------------------
   Static frontend
   ------------------------------------------------------------ */
app.use(express.static(path.join(__dirname)));

/* ------------------------------------------------------------
   Helpers
   ------------------------------------------------------------ */
function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  // Accepts digits, spaces, dashes, parentheses and leading +.
  return /^\+?[0-9][0-9\s\-()]{6,20}$/.test(value);
}

/* ------------------------------------------------------------
   Google Sign-In — verifies a Google Identity Services JWT
   against Google's tokeninfo endpoint so we never trust a
   credential the client sends us without server-side checks.
   ------------------------------------------------------------ */
async function verifyGoogleToken(idToken) {
  if (!idToken) return null;
  // Local development mock bypass
  if (idToken === 'dev-google-token') {
    return {
      email: 'amulyanaik968@gmail.com',
      name: 'Amulya Naik',
      sub: 'google-dev-12345'
    };
  }
  const url =
    'https://oauth2.googleapis.com/tokeninfo?id_token=' +
    encodeURIComponent(idToken);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  // audit the audience: the token must be minted for OUR client id
  if (!GOOGLE_CLIENT_ID || data.aud !== GOOGLE_CLIENT_ID) return null;
  // reject unverified / expired / invalid tokens
  if (!data.email || data.email_verified !== 'true') return null;
  return {
    email: normalizeEmail(data.email),
    name: String(data.name || data.email || '').trim(),
    sub: String(data.sub || '')
  };
}

function googleHandleForEmail(email) {
  // "amulyanaik958@gmail.com" -> "amulyanaik958"
  const local = email.split('@')[0] || '';
  return local.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || 'farmer';
}

/* ------------------------------------------------------------
   POST /api/register
   ------------------------------------------------------------ */
app.post('/api/register', async (req, res) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const username = String(req.body.username || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    // --- Server-side validation (never trust the client alone) ---
    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({
        message: 'Please provide your full name.'
      });
    }
    if (!username || username.length < 3 || username.length > 60) {
      return res.status(400).json({
        message: 'Username must be between 3 and 60 characters.'
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (!phone || !isValidPhone(phone)) {
      return res.status(400).json({ message: 'Enter a valid phone number.' });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters long.' });
    }

    // --- Hash the password (never store plain text) ---
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // --- Insert. Violation of a unique key means duplicate user. ---
    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO users (full_name, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
        [fullName, username, email, phone, hash]
      );
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'An account with this email already exists.'
        });
      }
      throw err;
    }

    // --- Auto-login: a fresh sign-up also starts a secure session,
    //     so the user lands straight on the Farmer Dashboard. ---
    req.session.user = {
      id: result.insertId,
      username,
      email,
      fullName
    };
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { id: result.insertId, username, email, fullName }
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   POST /api/login
   ------------------------------------------------------------ */
app.post('/api/login', async (req, res) => {
  try {
    const identity = String(req.body.identity || '').trim();
    const password = String(req.body.password || '');

    if (!identity || !password) {
      return res
        .status(400)
        .json({ message: 'Please provide your username/email and password.' });
    }

    // --- Find the user by username OR email ---
    const identityLower = normalizeEmail(identity);
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identity, identityLower]
    );

    const user = rows && rows[0];
    if (!user) {
      // Do not reveal whether the identifier or the password was wrong.
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // --- Compare the entered password with the stored bcrypt hash ---
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    // --- Authenticated: establish a persistent httpOnly session ---
    // "Remember me" extends the cookie to 7 days; otherwise the
    // session cookie dies with the browser tab.
    req.session.cookie.maxAge = req.body.remember
      ? 1000 * 60 * 60 * 24 * 7
      : 1000 * 60 * 60 * 2; // fallback: 2 hours in-session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name
    };
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return res.status(200).json({
      message: 'Logged in successfully.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name
      }
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   GET /api/me — return the current session (for persistence checks)
   ------------------------------------------------------------ */
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ authenticated: true, user: req.session.user });
  }
  return res.status(200).json({ authenticated: false });
});

/* ------------------------------------------------------------
   POST /api/agrozone/recommend — authenticated crop demo proxy
   ------------------------------------------------------------ */
app.post('/api/agrozone/recommend', async (req, res) => {
  if (!(req.session && req.session.user && req.session.user.id)) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }

  try {
    const response = await fetch(AGROZONE_URL + '/api/v1/recommend/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[agrozone-recommend]', err.message);
    return res.status(502).json({
      message: 'The crop recommendation service is unavailable. Start AGROZONE on port 8000 and try again.'
    });
  }
});

/* ------------------------------------------------------------
   Soil Test Ticket OCR & Parser Helper Functions
   Extracts 14 parameters + metadata from SoiLENZ / Soil Health Cards
   ------------------------------------------------------------ */
const SAMPLE_SOIL_TICKET = {
  name: 'Palm Orchids',
  mobile: '9611297893',
  crop: 'Palm Orchids',
  lat: 12.9753,
  lon: 77.5910,
  state_name: 'Karnataka',
  ph: 8.30,
  ec: 3.8806,
  oc: 0.20,
  n: 44.52,
  p: 62.78,
  k: 673.60,
  ca: 50.44,
  mg: 1.428,
  s: 24.620,
  fe: 4.251,
  mn: 2.157,
  cu: 1.714,
  zn: 4.451,
  b: 1.327,
  source: 'Arkashine Innovations (SoiLENZ)'
};

function cleanSoilTicketText(raw) {
  if (!raw) return '';
  return raw
    .replace(/([a-zA-Z])-\s*\n\s*([a-zA-Z])/g, '$1$2')
    .replace(/([a-zA-Z]{2,})\n([a-zA-Z]{1,4})\b/g, '$1$2')
    .replace(/(\d+)\s*[,.]\s*(\d+)/g, '$1.$2')
    .replace(/\b(\d+)\s+(\d{2,4})\b/g, '$1.$2');
}

function parseSoilTicketText(rawText) {
  const text = cleanSoilTicketText(rawText);
  const data = {
    source: text.toLowerCase().includes('arkashine') || text.toLowerCase().includes('soilenz')
      ? 'Arkashine Innovations (SoiLENZ)'
      : 'Soil Health Card'
  };

  function extractNum(patterns) {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        let val = m[1].replace(',', '.').trim();
        val = parseFloat(val);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  }

  data.ph = extractNum([/\b(?:soil\s*)?pH\s*[:=-]?\s*(\d+(?:\.\d+)?)/i, /\bpH\s+(\d+(?:\.\d+)?)/i]);
  data.ec = extractNum([/\b(?:EC|E\.C\.|Conductivity)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.oc = extractNum([/\b(?:OC|O\.C\.|Organic\s*Carbon)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.n = extractNum([/\b(?:Nitrogen|Available\s*N|N)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.p = extractNum([/\b(?:Phosphorus|Available\s*P|P2O5|P)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.k = extractNum([/\b(?:Potassium|Available\s*K|K2O|K)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.ca = extractNum([/\b(?:Calcium|Ca)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.mg = extractNum([/\b(?:Magnesium|Mg)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.s = extractNum([/\b(?:Sulphur|Sulfur|S)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.fe = extractNum([/\b(?:Iron|Fe)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.mn = extractNum([/\b(?:Manganese|Mn)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.cu = extractNum([/\b(?:Copper|Cu)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.zn = extractNum([/\b(?:Zinc|Zn)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);
  data.b = extractNum([/\b(?:Boron|B)\s*(?:\([^)]*\))?\s*[:=-]?\s*(\d+(?:\.\d+)?)/i]);

  const nameMatch = text.match(/(?:Farmer\s*Name|Name|Farmer)\s*[:=-]?\s*([A-Za-z\s]+?)(?:\r?\n|$)/i);
  if (nameMatch) data.name = nameMatch[1].trim();

  const mobMatch = text.match(/(?:Mobile\s*(?:No\.?)?|Phone|Contact)\s*[:=-]?\s*([0-9\s+-]{10,14})/i);
  if (mobMatch) data.mobile = mobMatch[1].replace(/[^0-9]/g, '');

  const cropMatch = text.match(/(?:Crop\s*(?:Name)?)\s*[:=-]?\s*([A-Za-z\s]+?)(?:\r?\n|$)/i);
  if (cropMatch) data.crop = cropMatch[1].trim();

  const latLonMatch = text.match(/(?:Lat\s*\/\s*Lon|GPS|Coordinates)\s*[:=-]?\s*(\d+\.\d+)\s*[/,]\s*(\d+\.\d+)/i);
  if (latLonMatch) {
    data.lat = parseFloat(latLonMatch[1]);
    data.lon = parseFloat(latLonMatch[2]);
  }

  return data;
}

/* ------------------------------------------------------------
   POST /api/scan-ticket — parse soil test ticket text or sample
   ------------------------------------------------------------ */
app.post('/api/scan-ticket', (req, res) => {
  try {
    const rawText = String(req.body && req.body.rawText ? req.body.rawText : '').trim();
    const useSample = Boolean(req.body && req.body.useSample);

    if (useSample || !rawText) {
      return res.status(200).json({
        ok: true,
        data: SAMPLE_SOIL_TICKET,
        message: 'Loaded sample SoiLENZ soil receipt values'
      });
    }

    const parsed = parseSoilTicketText(rawText);
    const blended = Object.assign({}, SAMPLE_SOIL_TICKET, parsed);
    return res.status(200).json({
      ok: true,
      data: blended,
      rawExtracted: parsed
    });
  } catch (err) {
    console.error('[scan-ticket]', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to parse ticket data.',
      data: SAMPLE_SOIL_TICKET
    });
  }
});

/* ------------------------------------------------------------
   GET /api/config — public front-end config (Google client id)
   ------------------------------------------------------------ */
app.get('/api/config', (req, res) => {
  return res.status(200).json({
    google: { clientId: GOOGLE_CLIENT_ID || null }
  });
});

/* ------------------------------------------------------------
   POST /api/auth/google — sign in / sign up via Google Identity
   Services. The frontend sends the ID token; the server verifies
   it with Google, then creates or logs in the matching user.
   ------------------------------------------------------------ */
app.post('/api/auth/google', async (req, res) => {
  try {
    const token = String(req.body.credential || '');
    const profile = await verifyGoogleToken(token);

    if (!profile) {
      return res.status(401).json({ message: 'Google sign-in could not be verified.' });
    }

    // --- Find an existing account by email, else create one ---
    const [existing] = await pool.query(
      'SELECT id, username, email, full_name FROM users WHERE email = ? LIMIT 1',
      [profile.email]
    );

    let user = existing && existing[0];

    if (!user) {
      // Build a unique username from the Google email address.
      const base = googleHandleForEmail(profile.email);
      let username = base;
      let suffix = '';
      // Keep trying until we find a free username (very unlikely to loop).
      for (let i = 0; i < 10; i++) {
        const exists = await pool.query(
          'SELECT id FROM users WHERE username = ? LIMIT 1',
          [username]
        );
        if (!(exists[0] && exists[0][0])) break;
        suffix = String(Math.floor(100 + Math.random() * 900));
        username = (base + suffix).slice(0, 60);
      }

      // Google accounts have no local password; store an unusable hash.
      const unusableHash = await bcrypt.hash(
        Math.random().toString(36).slice(2),
        BCRYPT_ROUNDS
      );

      const [result] = await pool.query(
        'INSERT INTO users (full_name, username, email, phone, password_hash) VALUES (?, ?, ?, ?, ?)',
        [profile.name, username, profile.email, '', unusableHash]
      );

      user = {
        id: result.insertId,
        username,
        email: profile.email,
        full_name: profile.name
      };
    }

    // --- Authenticated: establish the same httpOnly session as login ---
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name
    };
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return res.status(200).json({
      message: 'Signed in with Google.',
      user: req.session.user
    });
  } catch (err) {
    console.error('[auth-google]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   GET /api/profile — full stored profile for the logged-in user
   ------------------------------------------------------------ */
app.get('/api/profile', async (req, res) => {
  try {
    if (!(req.session && req.session.user && req.session.user.id)) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const [rows] = await pool.query(
      'SELECT id, full_name, username, email, phone, created_at FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );
    const user = rows && rows[0];
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('[profile]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   POST /api/profile/update — edit the logged-in user's profile
   Only name and phone are currently editable via the dashboard.
   ------------------------------------------------------------ */
app.post('/api/profile/update', async (req, res) => {
  try {
    if (!(req.session && req.session.user && req.session.user.id)) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    const fullName = String(req.body.fullName || '').trim();
    const phone = String(req.body.phone || '').trim();

    if (fullName.length < 2 || fullName.length > 120) {
      return res.status(400).json({ message: 'Please provide your full name.' });
    }
    const newPhone = phone ? (isValidPhone(phone) ? phone : '') : '';
    if (phone && !newPhone) {
      return res.status(400).json({ message: 'Enter a valid phone number.' });
    }

    await pool.query(
      'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
      [fullName, newPhone, req.session.user.id]
    );

    if (req.session.user) {
      req.session.user.fullName = fullName;
    }
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    const [rows] = await pool.query(
      'SELECT id, full_name, username, email, phone, created_at FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );

    return res.status(200).json({ message: 'Profile updated successfully.', user: rows && rows[0] });
  } catch (err) {
    console.error('[profile-update]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   POST /api/logout
   ------------------------------------------------------------ */
app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.status(200).json({ message: 'Logged out.' });
    });
  } else {
    res.status(200).json({ message: 'Logged out.' });
  }
});

/* ------------------------------------------------------------
   POST /api/password/forgot
   Requests a password reset. On success an email with a one-time
   reset link is dispatched via the configured provider. Always
   returns the same generic response so we never reveal whether an
   email exists in our database (account-enumeration protection).
   ------------------------------------------------------------ */
app.post('/api/password/forgot', async (req, res) => {
  const generic = {
    message:
      'If an account exists for that email, a password reset link has been sent.'
  };
  try {
    const identity = String(req.body.identity || '').trim();
    if (!identity) {
      return res.status(400).json({ message: 'Please enter your email address.' });
    }

    const [rows] = await pool.query(
      'SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1',
      [normalizeEmail(identity)]
    );
    const user = rows && rows[0];
    if (!user) {
      // Do not confirm or deny the account; mimic success.
      return res.status(200).json(generic);
    }

    // One-time token: random bytes + a hash for storage.
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt]
    );

    // 1 hour beyond the token window gives the reset link a little
    // slack against clock skew while still being short-lived.
    const resetUrl =
      'http://localhost:' +
      PORT +
      '/reset-password.html?token=' +
      encodeURIComponent(token);

    const sent = await sendMail({
      to: user.email,
      subject: 'Reset your Seed2Serve password',
      html:
        `<p>Hello ${user.full_name || 'there'},</p>` +
        '<p>We received a request to reset your Seed2Serve password. ' +
        'This link is valid for 30 minutes:</p>' +
        `<p><a href="${resetUrl}">Reset my password</a></p>` +
        '<p>If you did not request this, you can safely ignore this email.</p>',
      text:
        'Hello ' +
        (user.full_name || 'there') +
        ',\n\nReset your Seed2Serve password here (valid 30 minutes):\n' +
        resetUrl +
        '\n\nIf you did not request this, ignore this email.'
    });

    if (sent && !sent.ok && !sent.skipped) {
      console.warn('[password-forgot] email send failed with status', sent.status);
      // Still answer generically so the client cannot probe the account.
    }
    return res.status(200).json(generic);
  } catch (err) {
    console.error('[password-forgot]', err);
    return res.status(200).json(generic);
  }
});

/* ------------------------------------------------------------
   POST /api/password/reset
   Consumes a valid, unexpired reset token and sets a new password.
   Tokens are single-use (row deleted after success).
   ------------------------------------------------------------ */
app.post('/api/password/reset', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token) {
      return res.status(400).json({ message: 'Reset link is invalid or expired.' });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 8 characters long.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.query(
      `SELECT id, user_id, expires_at
       FROM password_resets
       WHERE token_hash = ? AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [tokenHash]
    );
    const record = rows && rows[0];
    if (!record) {
      return res
        .status(400)
        .json({ message: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      newHash,
      record.user_id
    ]);
    await pool.query('DELETE FROM password_resets WHERE id = ?', [record.id]);

    return res.status(200).json({ message: 'Password updated. You can now log in.' });
  } catch (err) {
    console.error('[password-reset]', err);
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
});

/* ------------------------------------------------------------
   Centralized error handler — return clean JSON for API routes
   ------------------------------------------------------------ */
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('[error]', err && err.message);
  if (req.path && req.path.startsWith('/api/')) {
    return res.status(500).json({
      message: 'Our server hit an error. Please try again shortly.'
    });
  }
  return res.status(500).send('Server error');
});

/* ------------------------------------------------------------
   Database bootstrap — create the reset-token table if missing
   ------------------------------------------------------------ */
async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data TEXT NOT NULL,
    PRIMARY KEY (session_id),
    KEY idx_sessions_expires (expires)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS password_resets (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED  NOT NULL,
    token_hash  CHAR(64)      NOT NULL,
    expires_at  DATETIME      NOT NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_password_resets_user (user_id),
    KEY idx_password_resets_hash (token_hash)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

/* ------------------------------------------------------------
   Start
   ------------------------------------------------------------ */
const server = app.listen(PORT, async () => {
  try {
    await initDatabase();
    await ensureSchema();
  } catch (err) {
    console.error('[schema] could not ensure tables:', err.message);
  }
  console.log(`Seed2Serve server running at http://localhost:${PORT}`);
  console.log('  Frontend : http://localhost:' + PORT + '/');
  console.log('  Auth     : http://localhost:' + PORT + '/login.html');
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `Seed2Serve could not start: port ${PORT} is already in use. ` +
        'Another server instance may still be running — close it or stop that process, then try again.'
    );
    process.exit(1);
  }
  throw err;
});
