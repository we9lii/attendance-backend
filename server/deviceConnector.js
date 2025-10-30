import ZKLib from 'node-zklib';

function getEnvBool(name, def = false) {
  const v = process.env[name];
  if (v == null) return def;
  return ['1','true','yes','on'].includes(String(v).toLowerCase());
}

export async function startDeviceConnector(pool) {
  if (!getEnvBool('ZK_ENABLED', false)) {
    console.log('ZKTeco device connector disabled (ZK_ENABLED not true).');
    return;
  }

  const host = process.env.ZK_HOST;
  const port = Number(process.env.ZK_PORT || 4370);
  const inport = Number(process.env.ZK_INPORT || 5200);
  const timeout = Number(process.env.ZK_TIMEOUT_MS || 5000);
  const commPassword = process.env.ZK_PASSWORD ? Number(process.env.ZK_PASSWORD) : undefined;
  const pollInterval = Number(process.env.ZK_INTERVAL_MS || 60000);

  if (!host) {
    throw new Error('ZK_HOST must be set in environment to enable device connector');
  }

  console.log(`Starting ZKTeco connector -> ${host}:${port} (inport=${inport}, timeout=${timeout})`);
  const zk = new ZKLib(host, port, inport, timeout, commPassword);

  try {
    await zk.createSocket();
  } catch (e) {
    console.error('Failed to connect to device:', e);
    throw e;
  }

  async function upsertAttendanceFromLog(log) {
    try {
      const userId = Number(log?.uid ?? log?.userId ?? log?.userid ?? log?.user?.uid);
      const tsRaw = log?.attendanceTime ?? log?.timestamp ?? log?.time ?? log?.record?.timestamp;
      if (!userId || !tsRaw) return;
      const ts = new Date(tsRaw);

      const day = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), 0, 0, 0);
      const lateThreshold = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), 8, 15, 0);

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
        }
      } else {
        const isLate = ts > lateThreshold;
        const lateMinutes = isLate ? Math.round((ts.getTime() - lateThreshold.getTime()) / 60000) : 0;
        await pool.query(
          `INSERT INTO attendance_logs (user_id, check_in, is_late, late_minutes, source)
           VALUES (?,?,?,?,?)`,
          [userId, ts, isLate ? 1 : 0, lateMinutes, 'جهاز البصمة']
        );
      }
    } catch (err) {
      console.error('Failed to upsert attendance from device log', err);
    }
  }

  // Initial poll to import all logs
  async function pollAll() {
    try {
      const logs = await zk.getAttendances();
      if (Array.isArray(logs)) {
        console.log(`Fetched ${logs.length} logs from device`);
        for (const log of logs) {
          await upsertAttendanceFromLog(log);
        }
      } else {
        console.log('Device returned non-array logs');
      }
    } catch (e) {
      console.error('Polling device logs failed:', e);
    }
  }

  await pollAll();
  // Periodic polling
  setInterval(pollAll, pollInterval);

  // Real-time logs (optional)
  try {
    await zk.getRealTimeLogs(async (data) => {
      await upsertAttendanceFromLog(data);
    });
    console.log('Subscribed to real-time logs from device');
  } catch (e) {
    console.warn('Real-time log subscription failed, falling back to interval polling only');
  }
}