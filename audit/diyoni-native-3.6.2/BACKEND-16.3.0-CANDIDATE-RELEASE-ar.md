# الخادم 16.3.0-candidate — جاهز للمراجعة، غير منشور

**المصدر:** `backend-candidate/` في المستودع الخاص (مرفوع ضمن المصدر الكامل في Drive).
**الأساس:** نسخة الإنتاج المجمّدة `docs/v3.4/backend-16.2.0` (لم تُلمس).

## ما تغيّر بالضبط
تحقّقتُ آلياً من أن كل ملف مطابق لنسخة الإنتاج 16.2.0 (بعد تجاهل نهايات الأسطر فقط)، باستثناء ثلاثة ملفات:
1. `package.json`: رقم الإصدار `16.3.0-candidate`، و`sharp` من 0.35.3 إلى 0.35.5.
2. `package-lock.json`: نتيجة `npm audit fix` دون `--force`، وتشمل undici و@fastify/busboy و@grpc/grpc-js وfast-xml-parser.
3. `api/workspace/_segmented-book.js`: **وحدة جديدة غير مربوطة بأي مسار API**، لذلك لا تغيّر سلوك الخادم.

## الاختبارات (بيئة منفصلة، دون شبكة، دون كتابة على الإنتاج)
| الفحص | النتيجة |
|---|---|
| verify-first-local-crosslang | ✅ 287 |
| verify-first-local-readiness | ✅ 78 |
| verify-optional-sync-backend | ✅ 219 |
| verify-optional-sync-http | ✅ 322 |
| verify-registration-email-policy | ✅ 66 |
| تحميل كل المعالجات (admin/users, access, debts, signup, backup, health) | ✅ |
| تكافؤ وحدة التجزئة مع Java (json.org وAndroid 16) | ✅ 93 |
| على Vercel الحقيقي / Firebase الحقيقي | ⛔ لم يُنفّذ: يحتاج نشراً وموافقتك |

## تقييم الثغرات حسب مسار الاستخدام الفعلي
| الحزمة | الحالة | المسار في كودنا | الخطر الفعلي |
|---|---|---|---|
| sharp (libheif) | **مُصلحة** | `api/workspace/_brand-logo.js` يعالج شعاراً يرفعه المستخدم | كان حقيقياً، وأُزيل |
| undici, @fastify/busboy, @grpc/grpc-js, fast-xml-parser | **مُصلحة** | اعتماديات غير مباشرة عبر firebase-admin | أُزيلت |
| zod ← @vercel/cli-config ← @vercel/oidc ← @vercel/blob | **باقية (4 تنبيهات = سلسلة واحدة)** | فقط `api/infra/_backup-repository.js`، أي النسخ الإداري للمالك/cron إلى Vercel Blob. `cli-config` يحلل ملفات إعداد Vercel CLI المحلية (`auth.json`/`config.json`) عند تجديد رمز OIDC | **مهمل:** لا يصل أي إدخال من المستخدم إلى هذا المحلل. الإصلاح الوحيد المتاح هو تخفيض `@vercel/blob` إلى 2.4.0، وهو كسر للتوافق، فلم يُطبَّق |

## خطوات النشر المقترحة (بعد موافقتك فقط)
1. نشر على **Preview** في Vercel من `backend-candidate/`، بنفس متغيرات البيئة ودون تغييرها.
2. على الـ Preview: `GET /api/health`، ثم تسجيل دخول بحساب اختبار، ثم رفع شعار PNG وJPEG صغير (مسار sharp)، ثم قراءة الدفتر والمزامنة بحساب اختبار.
3. الترقية إلى Production.
4. مراقبة سجلات Vercel 24 ساعة: أخطاء 5xx، و`backup_failed`.

## خطة الرجوع
- لا ترحيل بيانات ولا تغيير في قواعد Firebase، لذلك الرجوع آمن تماماً.
- Vercel ← Deployments ← نشر 16.2.0 السابق ← **Instant Rollback**، أو أعد نشر `docs/v3.4/backend-16.2.0` كما هو.
- التطبيقات 3.6.x متوافقة مع الإصدارين لأن العقد لم يتغير.

## ملاحظة الاستضافة
خطة Vercel Hobby مخصصة للاستخدام **غير التجاري**. انظر `COST-AND-HOSTING-ar.md` قبل أي نشر جديد.
