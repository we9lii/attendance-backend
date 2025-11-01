import dotenv from 'dotenv';
// Load env from .env.local first (frontend-style), then fallback to default .env
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import cors from 'cors';
import { startDeviceConnector } from './deviceConnector.js';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Config
// Prefer platform-provided PORT (Render/Heroku/etc), fallback to SERVER_PORT or 4000
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 4000);
const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE || 'http://qssun.dyndns.org:8085/personnel/api/';
const AUTH_MODE = (process.env.AUTH_MODE || 'basic').toLowerCase(); // 'basic' | 'jwt'
const API_USERNAME = process.env.API_USERNAME || '';
const API_PASSWORD = process.env.API_PASSWORD || '';
const API_JWT_TOKEN = process.env.API_JWT_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const EMPLOYEE_USERNAME = process.env.EMPLOYEE_USERNAME || 'employee';
const EMPLOYEE_PASSWORD = process.env.EMPLOYEE_PASSWORD || '';

// MySQL Connection
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const DB_SSL = ['1','true','yes','on'].includes(String(process.env.DB_SSL || '').toLowerCase());
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: DB_PORT,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_system',
  ssl: DB_SSL ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Track DB availability to allow degraded-mode startup when DB is offline
let DB_AVAILABLE = true;

async function initTables() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS approved_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      latitude DOUBLE NOT NULL,
      longitude DOUBLE NOT NULL,
      radius INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.query(`CREATE TABLE IF NOT EXISTS attendance_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      check_in DATETIME NOT NULL,
      check_out DATETIME NULL,
      is_late TINYINT(1) NOT NULL DEFAULT 0,
      late_minutes INT NOT NULL DEFAULT 0,
      excuse_reason TEXT NULL,
      mandatory_excuse_reason TEXT NULL,
      location_id INT NULL,
      source ENUM('جهاز البصمة','التطبيق') NOT NULL,
      device_log_key VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id), INDEX (check_in), INDEX(device_log_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.query(`CREATE TABLE IF NOT EXISTS leave_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      duration INT NULL,
      reason TEXT NOT NULL,
      status ENUM('قيد المراجعة','مقبول','مرفض') NOT NULL DEFAULT 'قيد المراجعة',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id), INDEX(date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.query(`CREATE TABLE IF NOT EXISTS excuse_requests (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      reason TEXT NOT NULL,
      status ENUM('قيد المراجعة','مقبول','مرفض') NOT NULL DEFAULT 'قيد المراجعة',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (user_id), INDEX(date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.query(`CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      target_user_ids TEXT NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_read TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await conn.query(`CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      from_user_id INT NOT NULL,
      to_user_id INT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      INDEX(from_user_id), INDEX(to_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Attempt to migrate old column name `read` to `is_read` if present
    try {
      await conn.query('ALTER TABLE notifications CHANGE COLUMN `read` `is_read` TINYINT(1) NOT NULL DEFAULT 0');
    } catch (e) { /* ignore if column doesn't exist */ }
    try {
      await conn.query('ALTER TABLE chat_messages CHANGE COLUMN `read` `is_read` TINYINT(1) NOT NULL DEFAULT 0');
    } catch (e) { /* ignore if column doesn't exist */ }
  } finally {
    conn.release();
  }
}

// External API helper
async function externalFetch(path) {
  const url = new URL(path, EXTERNAL_API_BASE).toString();
  const headers = { 'Accept': 'application/json' };
  if (AUTH_MODE === 'basic' && API_USERNAME && API_PASSWORD) {
    const basic = Buffer.from(`${API_USERNAME}:${API_PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  } else if (AUTH_MODE === 'jwt' && API_JWT_TOKEN) {
    headers['Authorization'] = `JWT ${API_JWT_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`External API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Server setup
const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
app.use(CORS_ORIGIN ? cors({ origin: CORS_ORIGIN }) : cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auth helpers
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function getAuth(req) {
  const hdr = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(hdr);
  return m ? m[1] : null;
}
function requireAuth(req, res, next) {
  try {
    const token = getAuth(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Auth routes (env-based admin for MVP; extend to DB users later)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username/password' });
    if (String(username) === ADMIN_USERNAME && String(password) === ADMIN_PASSWORD) {
      const token = signToken({ username, role: 'admin' });
      return res.json({ token, user: { username, role: 'admin' } });
    }
    if (String(username) === EMPLOYEE_USERNAME && String(password) === EMPLOYEE_PASSWORD) {
      const token = signToken({ username, role: 'employee' });
      return res.json({ token, user: { username, role: 'employee' } });
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/logout', (req, res) => {
  // Client should discard token; nothing to do server-side for stateless JWT
  res.json({ ok: true });
});

// Proxy endpoints to external system (employees/departments/areas/positions)
app.get('/api/employees', async (req, res) => {
  try {
    const data = await externalFetch('employees/');
    res.json(data);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

app.get('/api/departments', async (req, res) => {
  try {
    const data = await externalFetch('departments/');
    res.json(data);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

app.get('/api/areas', async (req, res) => {
  try {
    const data = await externalFetch('areas/');
    res.json(data);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

app.get('/api/positions', async (req, res) => {
  try {
    const data = await externalFetch('positions/');
    res.json(data);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

// Test connection to external fingerprint API
app.post('/api/test-fingerprint', async (req, res) => {
  try {
    const { url, username, password, authMode } = req.body || {};
    const target = String(url || EXTERNAL_API_BASE);
    const mode = String(authMode || AUTH_MODE).toLowerCase();
    const headers = { 'Accept': 'application/json' };
    if (mode === 'basic' && username && password) {
      const basic = Buffer.from(`${username}:${password}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    } else if (mode === 'jwt' && API_JWT_TOKEN) {
      headers['Authorization'] = `JWT ${API_JWT_TOKEN}`;
    }
    const resp = await fetch(target, { method: 'GET', headers });
    const ok = resp.ok;
    const status = resp.status;
    const text = await resp.text();
    res.json({ ok, status, preview: text.slice(0, 200) });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
});

// Approved locations
app.get('/api/approved-locations', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const [rows] = await pool.query('SELECT id, name, latitude, longitude, radius FROM approved_locations ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/approved-locations', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { name, latitude, longitude, radius } = req.body || {};
  if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof radius !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const [result] = await pool.query('INSERT INTO approved_locations (name, latitude, longitude, radius) VALUES (?,?,?,?)', [name, latitude, longitude, radius]);
  res.status(201).json({ id: result.insertId, name, latitude, longitude, radius });
});

// Update approved location
app.put('/api/approved-locations/:id', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const id = Number(req.params.id);
  const { name, latitude, longitude, radius } = req.body || {};
  if (!id || !name || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof radius !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  await pool.query('UPDATE approved_locations SET name = ?, latitude = ?, longitude = ?, radius = ? WHERE id = ?', [name, latitude, longitude, radius, id]);
  res.json({ id, name, latitude, longitude, radius });
});

// Delete approved location
app.delete('/api/approved-locations/:id', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Missing id' });
  await pool.query('DELETE FROM approved_locations WHERE id = ?', [id]);
  res.json({ ok: true });
});

// Attendance
app.post('/api/attendance', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userId, checkIn, checkOut, isLate, lateMinutes, excuseReason, mandatoryExcuseReason, locationId, source } = req.body || {};
  if (!userId || !checkIn || !source) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const [result] = await pool.query(
    `INSERT INTO attendance_logs (user_id, check_in, check_out, is_late, late_minutes, excuse_reason, mandatory_excuse_reason, location_id, source)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [userId, new Date(checkIn), checkOut ? new Date(checkOut) : null, isLate ? 1 : 0, lateMinutes || 0, excuseReason || null, mandatoryExcuseReason || null, locationId || null, source]
  );
  res.status(201).json({ id: result.insertId });
});

// Reports placeholder (extend later)
app.get('/api/attendance', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userId, from, to } = req.query;
  let sql = 'SELECT * FROM attendance_logs WHERE 1=1';
  const params = [];
  if (userId) { sql += ' AND user_id = ?'; params.push(Number(userId)); }
  if (from) { sql += ' AND check_in >= ?'; params.push(new Date(String(from))); }
  if (to) { sql += ' AND check_in <= ?'; params.push(new Date(String(to))); }
  sql += ' ORDER BY check_in DESC LIMIT 5000';
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userId, limit } = req.query;
  const lim = Math.max(1, Math.min(100, Number(limit) || 10));
  let sql = 'SELECT id, title, message, target_user_ids, timestamp, is_read AS `read` FROM notifications';
  let where = '';
  const params = [];
  if (userId) {
    // Include general notifications (NULL target_user_ids) or those that include userId in CSV list
    where = ' WHERE (target_user_ids IS NULL OR FIND_IN_SET(?, REPLACE(target_user_ids, " ", "")))';
    params.push(String(userId));
  }
  sql += where + ' ORDER BY timestamp DESC LIMIT ?';
  params.push(lim);
  const [rows] = await pool.query(sql, params);
  // Map DB rows into API shape
  const data = rows.map(r => ({
    id: r.id,
    title: r.title,
    message: r.message,
    timestamp: r.timestamp,
    read: !!r.read,
    targetUserIds: r.target_user_ids ? r.target_user_ids.split(',').map(x => Number(x.trim())).filter(Boolean) : undefined,
  }));
  res.json(data);
});

app.post('/api/notifications', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { title, message, targetUserIds } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'Missing title/message' });
  const csv = Array.isArray(targetUserIds) && targetUserIds.length ? targetUserIds.join(',') : null;
  const [result] = await pool.query(
    'INSERT INTO notifications (title, message, target_user_ids) VALUES (?,?,?)',
    [title, message, csv]
  );
  const id = result.insertId;
  const [rows] = await pool.query('SELECT id, title, message, target_user_ids, timestamp, is_read AS `read` FROM notifications WHERE id = ?', [id]);
  const r = rows[0];
  res.status(201).json({
    id: r.id,
    title: r.title,
    message: r.message,
    timestamp: r.timestamp,
    read: !!r.read,
    targetUserIds: r.target_user_ids ? r.target_user_ids.split(',').map(x => Number(x.trim())).filter(Boolean) : undefined,
  });
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing id' });
  await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [Number(id)]);
  res.json({ ok: true });
});

// Daily reminder at 07:50 for all employees
let lastReminderDate = null; // YYYY-MM-DD string
function scheduleDailyReminders() {
  setInterval(async () => {
    const now = new Date();
    const dayStr = now.toISOString().slice(0,10);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours === 7 && minutes === 50 && lastReminderDate !== dayStr) {
      lastReminderDate = dayStr;
      try {
        const title = 'تذكير حضور';
        const message = 'تذكير: موعد الحضور يبدأ الساعة 8:00 صباحًا';
        await pool.query('INSERT INTO notifications (title, message, target_user_ids, is_read) VALUES (?,?,?,?)', [title, message, null, 0]);
        console.log('Daily attendance reminder notification created');
      } catch (e) {
        console.error('Failed to create daily reminder notification', e);
      }
    }
  }, 30000); // check every 30 seconds
}

// Serve frontend production build (SPA) from ../dist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
import('fs').then(fs => {
  try {
    if (fs.existsSync(DIST_DIR)) {
      app.use(express.static(DIST_DIR));
      app.get('*', (req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
      });
    } else {
      console.warn('DIST directory not found. Build frontend before running production server.');
    }
  } catch (e) {
    console.warn('Failed to set up static serving for dist:', e);
  }
});

// Startup
initTables()
  .then(() => {
    DB_AVAILABLE = true;
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
    // Start device connector (ZKTeco) if enabled and DB is available
    startDeviceConnector(pool).catch(err => {
      console.error('Device connector failed to start:', err);
    });
    // Start daily reminders scheduler when DB is available
    scheduleDailyReminders();
  })
  .catch(err => {
    DB_AVAILABLE = false;
    console.warn('DB unavailable, starting server in degraded mode:', err);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} (DB offline)`);
    });
    // Do not start device connector or reminder scheduler when DB is offline
  });