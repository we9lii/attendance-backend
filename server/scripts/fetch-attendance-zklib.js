// Simple script to test fetching attendance logs using the `zklib` library (as requested)
// Run with: npm run zk:fetch

/*
  This script attempts to connect to the ZKTeco device and fetch attendance logs.
  It uses the zklib API signature provided by the user:
    import { ZKLib } from 'zklib';
    const zk = new ZKLib({ ip, port, timeout, inport });

  Notes:
  - If the device has a Comm Key (communication password), zklib may require additional configuration.
  - The provided snippet sets inport to 0; we keep that to match the user’s suggestion.
*/

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ZKLib = require('zklib');

console.log('بدء اختبار zklib لجلب سجلات الحضور (نمط callbacks)...');
const INPORT = Number(process.env.ZK_INPORT || 5200);
const zk = new ZKLib({
  ip: '192.168.100.23',
  port: 4370,
  inport: INPORT,
  timeout: 10000,
});

console.log(`الاتصال إلى ${'192.168.100.23'}:${4370} (inport=${INPORT}) ...`);
zk.connect(function (err) {
  if (err) {
    console.error('❌ فشل الاتصال بالجهاز:', err?.message || String(err));
    try { zk.disconnect(); } catch {}
    process.exit(2);
    return;
  }

  // جلب الوقت كمؤشر على نجاح الاتصال
  zk.getTime(function (err, t) {
    if (err) {
      console.warn('⚠️ تعذّر قراءة الوقت من الجهاز:', err?.message || String(err));
    } else {
      console.log('🕒 وقت الجهاز:', t?.toString?.() || t);
    }

    // جلب سجلات الحضور
    zk.getAttendance(function (err, logs) {
      try {
        if (err) {
          console.error('❌ خطأ أثناء جلب سجلات الحضور:', err?.message || String(err));
        } else {
          const count = Array.isArray(logs) ? logs.length : 0;
          console.log(`✅ تم جلب ${count} سجل حضور`);
          if (Array.isArray(logs)) {
            logs.slice(0, 5).forEach((log, i) => console.log(`[${i + 1}]`, log));
          } else {
            console.log('تنبيه: نوع بيانات السجلات غير مصفوفة:', logs);
          }
        }
      } finally {
        try { zk.disconnect(); } catch {}
      }
    });
  });
});