// Simple LAN Connector for ZKTeco devices
// Runs inside your local network, pulls logs from the device, and pushes to cloud backend
// Config via environment variables or inline defaults

import dotenv from 'dotenv';
dotenv.config();
import ZKLib from 'node-zklib';

// Config
const API_BASE = process.env.API_BASE || 'https://attendance-backend-u99p.onrender.com';
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';

const ZK_HOST = process.env.ZK_HOST || '';
const ZK_PORT = Number(process.env.ZK_PORT || 4370);
const ZK_INPORT = Number(process.env.ZK_INPORT || 5200);
const ZK_TIMEOUT_MS = Number(process.env.ZK_TIMEOUT_MS || 5000);
const ZK_PASSWORD = process.env.ZK_PASSWORD ? Number(process.env.ZK_PASSWORD) : undefined;
const ZK_INTERVAL_MS = Number(process.env.ZK_INTERVAL_MS || 60000);

if (!ZK_HOST) {
  console.error('Missing ZK_HOST. Please set device IP in environment.');
  process.exit(1);
}

async function pullLogsOnce() {
  const zk = new ZKLib(ZK_HOST, ZK_PORT, ZK_INPORT, ZK_TIMEOUT_MS, ZK_PASSWORD);
  try {
    await zk.createSocket();
    const logs = await zk.getAttendances();
    try { if (zk?.close) await zk.close(); } catch {}

    const payload = { logs };
    const url = `${API_BASE}/api/device-push-logs`;
    const headers = {
      'Content-Type': 'application/json',
      ...(CONNECTOR_TOKEN ? { Authorization: `Bearer ${CONNECTOR_TOKEN}` } : {}),
    };
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
    const text = await resp.text();
    if (!resp.ok) {
      console.error('Push failed:', resp.status, text);
    } else {
      console.log('Push ok:', text);
    }
  } catch (err) {
    console.error('Connector pull failed:', err?.message || err);
    try { if (zk?.close) await zk.close(); } catch {}
  }
}

console.log('Starting ZK LAN Connector:', { ZK_HOST, ZK_PORT, ZK_INPORT, ZK_INTERVAL_MS });
pullLogsOnce();
setInterval(pullLogsOnce, ZK_INTERVAL_MS);