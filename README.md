<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# تشغيل ونشر النظام

## التشغيل محليًا

**المتطلبات:** Node.js

1. تثبيت الاعتمادات: `npm install`
2. إنشاء ملف إعدادات: انسخ `.env.example` إلى `.env.local` وأكمل القيم المطلوبة (بدون رفع الأسرار إلى GitHub).
3. تشغيل الواجهة + الخادم: `npm run dev:all`

الخادم يوفّر مسار صحة: `GET /api/health`

## النشر عبر GitHub + Render (موصى به للباكند)

يُمكن رفع الباكند إلى Render لتفادي مشاكل السماح بالاتصال من الـ IP المحلي.

1. ادفع المشروع إلى GitHub.
2. في Render: أنشئ خدمة "Web Service" عبر الربط بالمستودع.
3. Render يستخدم ملف `render.yaml` تلقائيًا:
   - `buildCommand`: `npm install && npm run build`
   - `startCommand`: `node server/index.js`
   - `healthCheckPath`: `/api/health`
4. أضف متغيرات البيئة في Render (لوحة التحكم):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` (إن كان الاتصال يتطلب TLS)
   - `EXTERNAL_API_BASE`, `AUTH_MODE`, إلخ حسب الحاجة.
5. حدّث عنوان الخادم في الواجهة بإضافة `VITE_SERVER_URL` (مثال: `https://attendance-backend.onrender.com`).

### ضبط واجهة cPanel لتتصل بالباكند على Render بدون إعادة بناء

لدعم الضبط السريع في cPanel، تمت إضافة ملف `public/config.json` يُنسخ تلقائيًا إلى `dist/` عند البناء. يمكنك تعديل هذا الملف بعد الرفع مباشرة في cPanel:

- المسار: وثائق الموقع للدومين الفرعي (document root)، الملف: `config.json`.
- البنية:

```
{
  "API_BASE": "https://<رابط-خدمة-Render>"
}
```

- الواجهة تقرأ هذا العنوان في وقت التشغيل. إن لم يوجد الملف، ستستخدم قيمة `VITE_SERVER_URL` عند البناء، وإن لم توجد أيضًا ستسقط إلى `http://localhost:4000` (غير مناسب للإنتاج).

كما تمت إضافة ملف `public/.htaccess` لضمان عمل توجيهات SPA على cPanel ومنع عرض الفهارس.

### تقييد CORS في الباكند (اختياري)

يمكنك تعيين `CORS_ORIGIN` في بيئة Render ليقتصر الاستهلاك على أصل الواجهة:

- مثال: `CORS_ORIGIN=http://qcheck.qssun.solar`

إن تُرك فارغًا، تكون سياسة CORS مفتوحة كما كانت.

### تمكين الاتصال بقاعدة MySQL في cPanel

1. افتح `Remote MySQL` في cPanel.
2. أضف عنوان الـ IP الخاص بـ Render أو النطاق/النطاقات المسموح بها.
3. تأكد من فتح المنفذ `3306` لدى مزوّد الاستضافة وأن الاتصال الخارجي مسموح.
4. إن كان المزود يفرض SSL، عيّن `DB_SSL=true` في بيئة الباكند.

> ملاحظة: استخدام `%` كوايلد-كارد في `Remote MySQL` قد يكون غير آمن؛ الأفضل إتاحة IPات محددة فقط.

## بناء نسخة الإنتاج محليًا

1. بناء الواجهة: `npm run build`
2. تشغيل الخادم الإنتاجي الذي يقدّم `dist`: `npm run server`

## تكوينات مهمة

- الخادم يقرأ منفذ التشغيل من `PORT` (منصات سحابية) أو `SERVER_PORT` محليًا.
- يوجد مسار صحة: `GET /api/health`.
- CORS افتراضيًا مفتوح أثناء التطوير؛ في الإنتاج يُفضّل تحديد الأصل المسموح.
