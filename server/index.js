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
import ZKLib from 'node-zklib';
let bcrypt;
try {
  const mod = await import('bcryptjs');
  bcrypt = mod.default || mod;
  console.log('Crypto: bcryptjs loaded');
} catch (e) {
  bcrypt = null;
  console.warn('Crypto: bcryptjs not installed; DB-backed login disabled.');
}

// Config
// Prefer platform-provided PORT (Render/Heroku/etc), fallback to SERVER_PORT or 4000
const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 4000);
const EXTERNAL_API_BASE = process.env.EXTERNAL_API_BASE || 'http://qssun.dyndns.org:8085/personnel/api/';
const AUTH_MODE = (process.env.AUTH_MODE || 'basic').toLowerCase(); // 'basic' | 'jwt'
const API_USERNAME = process.env.API_USERNAME || '';
const API_PASSWORD = process.env.API_PASSWORD || '';
const API_JWT_TOKEN = process.env.API_JWT_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
// Allow disabling auth (JWT) completely via environment for deployments that don't need it
const DISABLE_AUTH = ['1','true','yes','on'].includes(String(process.env.DISABLE_AUTH || '').toLowerCase());
// Allow anonymous read-only access to users list when DB is offline (degraded mode)
const ALLOW_ANON_USERS = ['1','true','yes','on'].includes(String(process.env.ALLOW_ANON_USERS || '').toLowerCase());
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';
// Default env-based admin (for immediate access). Override via Render env.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1';
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
// Fallback local users store when DB is unavailable (degraded mode)
const localUsers = [];
let localUserId = 1;

async function initTables() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','employee') NOT NULL DEFAULT 'employee',
      department VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX(role), INDEX(active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

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
    // Add phone/email to users if missing
    try { await conn.query('ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL'); } catch (e) { /* ignore */ }
    try { await conn.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL'); } catch (e) { /* ignore */ }
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
// Configure CORS safely
const rawCorsOrigin = process.env.CORS_ORIGIN || '';
const allowedOrigins = rawCorsOrigin
  .split(',')
  .map(o => o.trim())
  .map(o => o.replace(/\/+$/, ''))
  .filter(o => o.length > 0);
// Optionally allow local/LAN dev origins without explicitly listing them
const ALLOW_LAN = ['1','true','yes','on'].includes(String(process.env.CORS_ALLOW_LAN || '').toLowerCase());

if (allowedOrigins.length === 0) {
  // Open CORS (for development or unrestricted mode)
  app.use(cors());
  console.log('CORS: open (CORS_ORIGIN not set or empty)');
} else {
  // Use dynamic origin function to handle multiple origins safely
  const allowedSet = new Set(allowedOrigins);
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // Normalize origin by removing trailing slashes before checking
      const normalized = origin.replace(/\/+$/, '');
      // Special case: wildcard '*' allows any origin
      if (allowedSet.has('*')) {
        return callback(null, true);
      }
      if (allowedSet.has(normalized)) {
        return callback(null, true);
      }
      // If ALLOW_LAN=true, allow typical local dev origins (localhost and private LAN ranges)
      if (ALLOW_LAN) {
        try {
          const host = new URL(origin).hostname || '';
          const isLocal = host === 'localhost' || host === '127.0.0.1';
          const isLan = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
          if (isLocal || isLan) {
            return callback(null, true);
          }
        } catch {}
      }
      console.warn('CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));
  console.log('CORS: restricted to origins ->', Array.from(allowedSet));
}
  app.use(express.json());

  // عندما تكون القاعدة غير متاحة محليًا، مرّر طلبات واجهة /api/* إلى خادم بعيد لتأمين بيانات فعلية
  const REMOTE_API_BASE = process.env.REMOTE_API_BASE || 'https://attendance-backend-u99p.onrender.com';
  app.use(async (req, res, next) => {
    try {
      if (!DB_AVAILABLE && req.originalUrl && req.originalUrl.startsWith('/api/')) {
        // لا تُحوّل مسارات لا تعتمد على قاعدة البيانات أو تحتاج مصادقة محلية
        // أمثلة: تسجيل الدخول، التحقق من المستخدم الحالي، إدارة المستخدمين المحلية عند تعذّر القاعدة، تسجيل الخروج، الصحة
        const skipForward = (
          req.originalUrl.startsWith('/api/login') ||
          req.originalUrl.startsWith('/api/logout') ||
          req.originalUrl.startsWith('/api/me') ||
          req.originalUrl.startsWith('/api/users') ||
          req.originalUrl.startsWith('/api/health') ||
          // لا تحوّل طلبات الطلبات والدردشة، أبقها محلية وإلا ستفشل على الخادم البعيد
          req.originalUrl.startsWith('/api/requests') ||
          req.originalUrl.startsWith('/api/chat')
        );
        if (skipForward) {
          return next();
        }
        const url = REMOTE_API_BASE.replace(/\/+$/, '') + req.originalUrl;
        const headers = { ...req.headers };
        delete headers['host'];
        // حافظ على التوكين إن وُجد
        if (req.headers['authorization']) {
          headers['authorization'] = req.headers['authorization'];
        }
        // اضبط نوع المحتوى الافتراضي للطلبات غير GET/HEAD
        if (!headers['content-type'] && req.method !== 'GET' && req.method !== 'HEAD') {
          headers['content-type'] = 'application/json';
        }
        const opts = { method: req.method, headers };
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          // أرسل الجسم كـ JSON إن كان مفصولًا
          opts.body = headers['content-type'] && String(headers['content-type']).includes('application/json')
            ? JSON.stringify(req.body || {})
            : req.body;
        }
        const resp = await fetch(url, opts);
        const ct = resp.headers.get('content-type') || 'application/json';
        const buf = Buffer.from(await resp.arrayBuffer());
        res.status(resp.status).set('content-type', ct).send(buf);
        return; // لا تُكمل إلى الراوتر المحلي
      }
    } catch (e) {
      return res.status(502).json({ error: String(e.message || e) });
    }
    next();
  });

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));
// DB health: tries to get a connection and run SELECT 1
app.get('/api/health/db', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.query('SELECT 1 AS ok');
      return res.json({ server: true, db: true });
    } finally { conn.release(); }
  } catch (e) {
    return res.status(503).json({ server: true, db: false, error: String(e.message || e) });
  }
});
// Public IP health: shows server's outward IP (useful for Remote MySQL whitelisting)
app.get('/api/health/ip', async (req, res) => {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return res.json({ server: true, ip: data?.ip || null });
  } catch (e) {
    return res.status(502).json({ server: true, error: String(e.message || e) });
  }
});

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
  if (DISABLE_AUTH) {
    // Skip auth entirely when disabled
    return next();
  }
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
function requireAdmin(req, res, next) {
  if (DISABLE_AUTH) {
    // Skip admin check when auth is disabled
    return next();
  }
  try {
    const token = getAuth(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
// Optional auth guard for users list when DB is offline and anonymous mode enabled
function optionalAuthForUsers(req, res, next) {
  if (!DB_AVAILABLE && ALLOW_ANON_USERS && req.method === 'GET') {
    // Skip auth for read-only users list in degraded mode
    return next();
  }
  return requireAuth(req, res, next);
}

// Auth routes (env-based admin for MVP; extend to DB users later)
// مثال للطلب (Body) لتسجيل الدخول بسرعة بالحساب الوهمي 1/1:
// Body: { "username": "1", "password": "1" }
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing username/password' });
    // Try DB-backed users first
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.query('SELECT id, username, password_hash, role, name FROM users WHERE username = ? AND active = 1', [username]);
        const user = Array.isArray(rows) ? rows[0] : null;
        if (bcrypt && user && await bcrypt.compare(String(password), String(user.password_hash))) {
          const token = signToken({ id: user.id, username: user.username, role: user.role, name: user.name });
          return res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
        }
      } finally { conn.release(); }
    } catch (e) {
      // DB unavailable or query failed; fall back to env-based accounts below
    }
    // Debug: log env-based credentials check
    console.log('LOGIN attempt', { username: String(username), password: String(password) ? '***' : '' }, 'ADMIN env', { ADMIN_USERNAME, ADMIN_PASSWORD: ADMIN_PASSWORD ? '***' : '' });
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

// Local users management
app.get('/api/users', optionalAuthForUsers, async (req, res) => {
  try {
    // Fallback: when DB is unavailable, return local in-memory users list
    if (!DB_AVAILABLE) {
      return res.json(localUsers);
    }
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT id, name, username, role, department, phone, email, active, created_at FROM users ORDER BY id ASC');
      res.json(rows);
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { name, username, password, role, department, phone, email } = req.body || {};
    if (!name || !username || !password) return res.status(400).json({ error: 'Missing name/username/password' });
    const r = String(role || 'employee');
    if (!['admin','employee'].includes(r)) return res.status(400).json({ error: 'Invalid role' });
    // Fallback: when DB is unavailable, simulate user creation in-memory
    if (!DB_AVAILABLE) {
      const user = {
        id: localUserId++,
        name,
        username,
        role: r,
        department: department || null,
        phone: phone || null,
        email: email || null,
        active: 1,
      };
      localUsers.push(user);
      return res.json(user);
    }
    // Normal path: DB available
    if (!bcrypt) return res.status(503).json({ error: 'Password hashing unavailable (bcryptjs not installed)' });
    const hash = await bcrypt.hash(String(password), 10);
    const conn = await pool.getConnection();
    try {
      await conn.query('INSERT INTO users (name, username, password_hash, role, department, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, username, hash, r, department || null, phone || null, email || null]);
      const [rows] = await conn.query('SELECT id, name, username, role, department, phone, email, active, created_at FROM users WHERE username = ?', [username]);
      const user = Array.isArray(rows) ? rows[0] : null;
      res.json(user || { ok: true });
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, department, role, active, password, phone, email } = req.body || {};
    const conn = await pool.getConnection();
    try {
      if (password) {
        if (!bcrypt) { conn.release(); return res.status(503).json({ error: 'Password hashing unavailable (bcryptjs not installed)' }); }
        const hash = await bcrypt.hash(String(password), 10);
        await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
      }
      const fields = [];
      const values = [];
      if (name !== undefined) { fields.push('name = ?'); values.push(name); }
      if (department !== undefined) { fields.push('department = ?'); values.push(department); }
      if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
      if (email !== undefined) { fields.push('email = ?'); values.push(email); }
      if (role !== undefined && ['admin','employee'].includes(String(role))) { fields.push('role = ?'); values.push(String(role)); }
      if (active !== undefined) { fields.push('active = ?'); values.push(Number(!!active)); }
      if (fields.length) {
        await conn.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
      }
      const [rows] = await conn.query('SELECT id, name, username, role, department, phone, email, active, created_at FROM users WHERE id = ?', [id]);
      res.json(Array.isArray(rows) ? rows[0] : { ok: true });
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const conn = await pool.getConnection();
    try {
      await conn.query('DELETE FROM users WHERE id = ?', [id]);
      res.json({ ok: true });
    } finally { conn.release(); }
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
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

// Fetch users directly from a ZKTeco device (no DB required)
// You can provide connection params in body or rely on env vars: ZK_HOST, ZK_PORT, ZK_INPORT, ZK_TIMEOUT_MS, ZK_PASSWORD
app.post('/api/device-users', async (req, res) => {
  try {
    const { host, port, inport, timeout, password } = req.body || {};
    const h = String(host || process.env.ZK_HOST || '');
    const p = Number(port || process.env.ZK_PORT || 4370);
    const ip = Number(inport || process.env.ZK_INPORT || 5200);
    const to = Number(timeout || process.env.ZK_TIMEOUT_MS || 5000);
    const commPassword = password ? Number(password) : (process.env.ZK_PASSWORD ? Number(process.env.ZK_PASSWORD) : undefined);
    if (!h) return res.status(400).json({ error: 'Missing ZK device host (host or ZK_HOST)' });

    const zk = new ZKLib(h, p, ip, to, commPassword);
    await zk.createSocket();
    const users = await zk.getUsers();
    try { if (zk?.close) await zk.close(); } catch {}

    const mapped = Array.isArray(users) ? users.map(u => ({
      id: Number(u?.uid ?? u?.userId ?? u?.userid ?? 0),
      name: String(u?.name ?? u?.username ?? 'مستخدم'),
      department: String(u?.department ?? 'غير محدد'),
    })).filter(u => u.id) : [];
    res.json(mapped);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
});

// Test connectivity to a ZKTeco device (quick ping via users or attendances)
// Accepts same params as /api/device-users; returns device reachability and counts
app.post('/api/device-test', async (req, res) => {
  try {
    const { host, port, inport, timeout, password } = req.body || {};
    const h = String(host || process.env.ZK_HOST || '');
    const p = Number(port || process.env.ZK_PORT || 4370);
    const ip = Number(inport || process.env.ZK_INPORT || 5200);
    const to = Number(timeout || process.env.ZK_TIMEOUT_MS || 5000);
    const commPassword = password ? Number(password) : (process.env.ZK_PASSWORD ? Number(process.env.ZK_PASSWORD) : undefined);
    if (!h) return res.status(400).json({ error: 'Missing ZK device host (host or ZK_HOST)' });

    const zk = new ZKLib(h, p, ip, to, commPassword);
    await zk.createSocket();
    let usersCount = null;
    let attendancesCount = null;
    try {
      const users = await zk.getUsers();
      usersCount = Array.isArray(users) ? users.length : null;
    } catch {}
    try {
      const logs = await zk.getAttendances();
      attendancesCount = Array.isArray(logs) ? logs.length : null;
    } catch {}
    try { if (zk?.close) await zk.close(); } catch {}
    res.json({ ok: true, host: h, port: p, inport: ip, timeout: to, usersCount, attendancesCount });
  } catch (e) {
    res.status(502).json({ ok: false, error: String(e.message || e) });
  }
});

// Fetch attendance logs directly from ZKTeco device (optional DB save in future)
// This endpoint connects to device and returns simplified logs without requiring DB
app.post('/api/device-attendances', async (req, res) => {
  try {
    const { host, port, inport, timeout, password } = req.body || {};
    const h = String(host || process.env.ZK_HOST || '');
    const p = Number(port || process.env.ZK_PORT || 4370);
    const ip = Number(inport || process.env.ZK_INPORT || 5200);
    const to = Number(timeout || process.env.ZK_TIMEOUT_MS || 5000);
    const commPassword = password ? Number(password) : (process.env.ZK_PASSWORD ? Number(process.env.ZK_PASSWORD) : undefined);
    if (!h) return res.status(400).json({ error: 'Missing ZK device host (host or ZK_HOST)' });

    const zk = new ZKLib(h, p, ip, to, commPassword);
    await zk.createSocket();
    const logs = await zk.getAttendances();
    try { if (zk?.close) await zk.close(); } catch {}

    const mapped = Array.isArray(logs) ? logs.map(l => {
      const userId = Number(l?.uid ?? l?.userId ?? l?.userid ?? 0);
      const tsRaw = l?.attendanceTime ?? l?.timestamp ?? l?.time ?? l?.record?.timestamp;
      const ts = tsRaw ? new Date(tsRaw) : new Date();
      return {
        userId,
        timestamp: ts.toISOString(),
        raw: l,
      };
    }).filter(x => x.userId) : [];
    res.json({ count: mapped.length, logs: mapped });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
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

// Enforce one check-in per day
app.post('/api/attendance/check-in', requireAuth, async (req, res) => {
  try {
    if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
    const { userId, locationId, source } = req.body || {};
    if (!userId || !source) return res.status(400).json({ error: 'Missing required fields' });

    const now = new Date();
    // Late threshold at 08:15 local time
    const lateThreshold = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 15, 0);

    // Check existing record for today
    const [rows] = await pool.query(
      'SELECT id, check_in, check_out FROM attendance_logs WHERE user_id=? AND DATE(check_in)=DATE(?) ORDER BY check_in ASC LIMIT 1',
      [Number(userId), now]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return res.status(409).json({ error: 'Already checked in today' });
    }

    const isLate = now > lateThreshold;
    const lateMinutes = isLate ? Math.round((now.getTime() - lateThreshold.getTime()) / 60000) : 0;
    const [result] = await pool.query(
      `INSERT INTO attendance_logs (user_id, check_in, is_late, late_minutes, location_id, source)
       VALUES (?,?,?,?,?,?)`,
      [Number(userId), now, isLate ? 1 : 0, lateMinutes, locationId || null, String(source)]
    );
    return res.status(201).json({ id: result.insertId, userId: Number(userId), checkIn: now.toISOString(), isLate, lateMinutes, locationId: locationId || null, source: String(source) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Enforce one check-out per day
app.post('/api/attendance/check-out', requireAuth, async (req, res) => {
  try {
    if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'Missing required fields' });

    const now = new Date();
    const [rows] = await pool.query(
      'SELECT id, check_in, check_out FROM attendance_logs WHERE user_id=? AND DATE(check_in)=DATE(?) ORDER BY check_in ASC LIMIT 1',
      [Number(userId), now]
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(409).json({ error: 'No check-in recorded today' });
    }
    const rec = rows[0];
    if (rec.check_out) {
      return res.status(409).json({ error: 'Already checked out today' });
    }
    // Only allow checkout after check-in time
    const checkIn = new Date(rec.check_in);
    if (now <= checkIn) {
      return res.status(400).json({ error: 'Invalid checkout time' });
    }
    await pool.query('UPDATE attendance_logs SET check_out=? WHERE id=?', [now, rec.id]);
    return res.json({ id: rec.id, userId: Number(userId), checkOut: now.toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
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

// Requests API (leave/excuse)
// Unified list
app.get('/api/requests', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userId, status, type, limit } = req.query;
  const lim = Math.max(1, Math.min(1000, Number(limit) || 500));
  const paramsLeave = [];
  const paramsExcuse = [];
  let whereLeave = '1=1';
  let whereExcuse = '1=1';
  if (userId) { whereLeave += ' AND user_id = ?'; paramsLeave.push(Number(userId)); whereExcuse += ' AND user_id = ?'; paramsExcuse.push(Number(userId)); }
  if (status) { whereLeave += ' AND status = ?'; paramsLeave.push(String(status)); whereExcuse += ' AND status = ?'; paramsExcuse.push(String(status)); }
  if (type) {
    const t = String(type);
    if (t === 'إجازة' || t.toLowerCase().includes('leave')) {
      whereExcuse += ' AND 0'; // exclude
    } else if (t === 'عذر' || t.toLowerCase().includes('excuse')) {
      whereLeave += ' AND 0'; // exclude
    }
  }
  const [leaveRows] = await pool.query(
    `SELECT id, user_id, date, duration, reason, status, created_at FROM leave_requests WHERE ${whereLeave} ORDER BY created_at DESC LIMIT ?`,
    [...paramsLeave, lim]
  );
  const [excuseRows] = await pool.query(
    `SELECT id, user_id, date, NULL AS duration, reason, status, created_at FROM excuse_requests WHERE ${whereExcuse} ORDER BY created_at DESC LIMIT ?`,
    [...paramsExcuse, lim]
  );
  const data = [
    ...leaveRows.map(r => ({ id: r.id, userId: r.user_id, type: 'إجازة', date: r.date, duration: r.duration || undefined, reason: r.reason, status: r.status })),
    ...excuseRows.map(r => ({ id: r.id, userId: r.user_id, type: 'عذر', date: r.date, reason: r.reason, status: r.status }))
  ].sort((a, b) => (new Date(b.date).getTime()) - (new Date(a.date).getTime()));
  res.json(data);
});

// Create request
app.post('/api/requests', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userId, type, date, duration, reason } = req.body || {};
  if (!userId || !type || !date || !reason) return res.status(400).json({ error: 'Missing fields' });
  const t = String(type);
  if (t === 'إجازة' || t.toLowerCase().includes('leave')) {
    const [result] = await pool.query(
      'INSERT INTO leave_requests (user_id, date, duration, reason, status) VALUES (?,?,?,?,?)',
      [Number(userId), new Date(String(date)), (duration != null ? Number(duration) : null), String(reason), 'قيد المراجعة']
    );
    const id = result.insertId;
    const [rows] = await pool.query('SELECT id, user_id, date, duration, reason, status FROM leave_requests WHERE id=?', [id]);
    const r = rows[0];
    return res.status(201).json({ id: r.id, userId: r.user_id, type: 'إجازة', date: r.date, duration: r.duration || undefined, reason: r.reason, status: r.status });
  } else if (t === 'عذر' || t.toLowerCase().includes('excuse')) {
    const [result] = await pool.query(
      'INSERT INTO excuse_requests (user_id, date, reason, status) VALUES (?,?,?,?)',
      [Number(userId), new Date(String(date)), String(reason), 'قيد المراجعة']
    );
    const id = result.insertId;
    const [rows] = await pool.query('SELECT id, user_id, date, reason, status FROM excuse_requests WHERE id=?', [id]);
    const r = rows[0];
    return res.status(201).json({ id: r.id, userId: r.user_id, type: 'عذر', date: r.date, reason: r.reason, status: r.status });
  }
  return res.status(400).json({ error: 'Invalid type' });
});

// Update request status
app.put('/api/requests/:id', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const id = Number(req.params.id);
  const { status, type } = req.body || {};
  if (!id || !status || !type) return res.status(400).json({ error: 'Missing id/status/type' });
  const st = String(status);
  const t = String(type);
  if (!['قيد المراجعة','مقبول','مرفض'].includes(st)) return res.status(400).json({ error: 'Invalid status' });
  if (t === 'إجازة' || t.toLowerCase().includes('leave')) {
    await pool.query('UPDATE leave_requests SET status=? WHERE id=?', [st, id]);
    const [rows] = await pool.query('SELECT id, user_id, date, duration, reason, status FROM leave_requests WHERE id=?', [id]);
    const r = rows[0];
    return res.json({ id: r.id, userId: r.user_id, type: 'إجازة', date: r.date, duration: r.duration || undefined, reason: r.reason, status: r.status });
  } else if (t === 'عذر' || t.toLowerCase().includes('excuse')) {
    await pool.query('UPDATE excuse_requests SET status=? WHERE id=?', [st, id]);
    const [rows] = await pool.query('SELECT id, user_id, date, reason, status FROM excuse_requests WHERE id=?', [id]);
    const r = rows[0];
    return res.json({ id: r.id, userId: r.user_id, type: 'عذر', date: r.date, reason: r.reason, status: r.status });
  }
  return res.status(400).json({ error: 'Invalid type' });
});

// Chat API
// Fetch messages: either conversation (userA/userB) or by userId
app.get('/api/chat/messages', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userA, userB, userId, limit } = req.query;
  const lim = Math.max(1, Math.min(500, Number(limit) || 100));
  let sql = 'SELECT id, from_user_id, to_user_id, message, timestamp, is_read AS `read` FROM chat_messages';
  const params = [];
  if (userA && userB) {
    sql += ' WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)';
    params.push(Number(userA), Number(userB), Number(userB), Number(userA));
  } else if (userId) {
    sql += ' WHERE (from_user_id = ?) OR (to_user_id = ?)';
    params.push(Number(userId), Number(userId));
  }
  sql += ' ORDER BY timestamp ASC LIMIT ?';
  params.push(lim);
  const [rows] = await pool.query(sql, params);
  const data = rows.map(r => ({ id: r.id, fromUserId: r.from_user_id, toUserId: r.to_user_id, message: r.message, timestamp: r.timestamp, read: !!r.read }));
  res.json(data);
});

// Send message
app.post('/api/chat/messages', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { fromUserId, toUserId, message } = req.body || {};
  if (!fromUserId || !toUserId || !message) return res.status(400).json({ error: 'Missing fields' });
  const [result] = await pool.query('INSERT INTO chat_messages (from_user_id, to_user_id, message) VALUES (?,?,?)', [Number(fromUserId), Number(toUserId), String(message)]);
  const id = result.insertId;
  const [rows] = await pool.query('SELECT id, from_user_id, to_user_id, message, timestamp, is_read AS `read` FROM chat_messages WHERE id=?', [id]);
  const r = rows[0];
  res.status(201).json({ id: r.id, fromUserId: r.from_user_id, toUserId: r.to_user_id, message: r.message, timestamp: r.timestamp, read: !!r.read });
});

// Mark conversation messages as read (messages received by userA from userB)
app.post('/api/chat/read', requireAuth, async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  const { userA, userB } = req.body || {};
  if (!userA || !userB) return res.status(400).json({ error: 'Missing userA/userB' });
  await pool.query('UPDATE chat_messages SET is_read = 1 WHERE to_user_id = ? AND from_user_id = ?', [Number(userA), Number(userB)]);
  res.json({ ok: true });
});

// Receive attendance logs pushed from an in-LAN connector
// Security: require a shared bearer token via CONNECTOR_TOKEN
app.post('/api/device-push-logs', async (req, res) => {
  if (!DB_AVAILABLE) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const hdr = String(req.headers['authorization'] || '');
    const m = /^Bearer\s+(.+)$/i.exec(hdr);
    const token = m ? m[1] : '';
    if (!CONNECTOR_TOKEN || token !== CONNECTOR_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const logs = Array.isArray(req.body?.logs) ? req.body.logs : [];
    if (!logs.length) return res.status(400).json({ error: 'Missing logs array' });

    let inserted = 0;
    let updated = 0;
    for (const log of logs) {
      try {
        const userId = Number(log?.uid ?? log?.userId ?? log?.userid ?? log?.user?.uid);
        const tsRaw = log?.attendanceTime ?? log?.timestamp ?? log?.time ?? log?.record?.timestamp;
        if (!userId || !tsRaw) continue;
        const ts = new Date(tsRaw);

        const day = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), 0, 0, 0);
        const [lh, lm] = String(process.env.LATE_THRESHOLD || '08:15').split(':').map(n => Number(n));
        const lateThreshold = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), lh || 8, lm || 15, 0);

        // find existing record for this user/day
        const [rows] = await pool.query(
          'SELECT id, check_in, check_out FROM attendance_logs WHERE user_id=? AND DATE(check_in)=DATE(?) ORDER BY check_in ASC LIMIT 1',
          [userId, ts]
        );

        if (Array.isArray(rows) && rows.length > 0) {
          const rec = rows[0];
          const checkIn = new Date(rec.check_in);
          if (!rec.check_out && ts > checkIn) {
            await pool.query('UPDATE attendance_logs SET check_out=? WHERE id=?', [ts, rec.id]);
            updated++;
          }
        } else {
          const isLate = ts > lateThreshold;
          const lateMinutes = isLate ? Math.round((ts.getTime() - lateThreshold.getTime()) / 60000) : 0;
          await pool.query(
            `INSERT INTO attendance_logs (user_id, check_in, is_late, late_minutes, source)
             VALUES (?,?,?,?,?)`,
            [userId, ts, isLate ? 1 : 0, lateMinutes, 'جهاز البصمة']
          );
          inserted++;
        }
      } catch (err) {
        // continue on per-log errors
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
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

// Absence alerts at 08:45: notify admins with list of absentees and remind absent employees
let lastAbsenceAlertDate = null; // YYYY-MM-DD string
async function getAbsenteesForToday() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const [userRows] = await pool.query("SELECT id, name FROM users WHERE role='employee' AND active=1");
  const [attRows] = await pool.query("SELECT DISTINCT user_id FROM attendance_logs WHERE DATE(check_in)=?", [dateStr]);
  const presentSet = new Set(Array.isArray(attRows) ? attRows.map(r => Number(r.user_id)) : []);
  const absentees = (Array.isArray(userRows) ? userRows : []).filter(u => !presentSet.has(Number(u.id)));
  return absentees;
}
function scheduleAbsenceAlerts() {
  setInterval(async () => {
    if (!DB_AVAILABLE) return;
    const now = new Date();
    const dayStr = now.toISOString().slice(0,10);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours === 8 && minutes === 45 && lastAbsenceAlertDate !== dayStr) {
      lastAbsenceAlertDate = dayStr;
      try {
        const absentees = await getAbsenteesForToday();
        // Notify admins with list of names
        const [adminRows] = await pool.query("SELECT id FROM users WHERE role='admin' AND active=1");
        const adminIds = (Array.isArray(adminRows) ? adminRows.map(r => Number(r.id)) : []);
        const names = absentees.map(a => a.name).join(', ') || 'لا يوجد غياب';
        const adminTitle = 'قائمة الغائبين اليوم';
        const adminMsg = `الأسماء: ${names}`;
        await pool.query('INSERT INTO notifications (title, message, target_user_ids, is_read) VALUES (?,?,?,?)', [adminTitle, adminMsg, adminIds.length ? adminIds.join(',') : null, 0]);
        // Notify each absent employee to check-in
        for (const emp of absentees) {
          const empTitle = 'تذكير تسجيل حضور';
          const empMsg = 'يرجى تسجيل حضورك الآن.';
          await pool.query('INSERT INTO notifications (title, message, target_user_ids, is_read) VALUES (?,?,?,?)', [empTitle, empMsg, String(emp.id), 0]);
        }
        console.log('Absence alerts created for', absentees.length, 'employees');
      } catch (e) {
        console.error('Failed to create absence alerts', e);
      }
    }
  }, 30000);
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
    // Start absence alerts scheduler (08:45)
    scheduleAbsenceAlerts();
  })
  .catch(err => {
    DB_AVAILABLE = false;
    console.warn('DB unavailable, starting server in degraded mode:', err);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} (DB offline)`);
    });
    // Do not start device connector or reminder scheduler when DB is offline
  });