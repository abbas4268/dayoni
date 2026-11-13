# بناء ديوني 3.6.2 وتحديثه

## المتطلبات
- JDK 17 أو أحدث (جُرّب 21)، وGradle 8.13 أو أحدث (جُرّب 8.14.3، أو `./gradlew`)، وAndroid SDK 36 مع build-tools 36.0.0.
- ملف `local.properties` يحتوي `sdk.dir=…`، وهو مستبعد من المصدر.
- **التوقيع:** ملف خصائص خارج المشروع بصلاحية 0600، يحتوي بالضبط:
  `storeFile, storeType=JKS, keyAlias, storePassword, keyPassword`، ويشير إلى مفتاح D5 الأصلي.
  لا تضع هذا الملف في المشروع أو GitHub أو مجلد مشترك.

## البناء
```
export DIYONI_SIGNING_PROPERTIES=/مسار/خاص/android-signing.properties
./gradlew :customer:assembleRelease :admin:assembleRelease :customer:bundleRelease :admin:bundleRelease
```
تحقق من التوقيع قبل التثبيت:
```
apksigner verify --print-certs customer/build/outputs/apk/release/customer-release.apk
```
يجب أن تكون بصمة SHA-256 للشهادة:
`D5AA7B93D6DBC50A256617339CEF59B6C43B791ACE38E49C03F240830C0CE3E9`

## الاختبارات (دون جهاز)
```
export DIYONI_TEST_JSON_JAR=…/json-20240303.jar ANDROID_HOME=… LANG=C.UTF-8
for s in tests/run-*.sh; do bash "$s"; done
```
- 30 مجموعة تحتاج جهازاً أو محاكياً، وتتخطاها البيئة دون جهاز.
- لاختبار org.json الخاص بـ Android: مرّر `DIYONI_TEST_JSON_JAR` إلى jar يحوي `org/json` المستخرج من android-all.

## التحديث على الهاتف (اختبار قبل النشر)
1. سجّل الأرصدة قبل التحديث: إجمالي المستحق، عدد الزبائن، عدد الديون، ورصيد زبونين محددين.
2. ثبّت `customer-release.apk` الموقّع بـ D5 **فوق** 3.6.0 دون إلغاء التثبيت ودون مسح البيانات.
3. افتح التطبيق وقارن الأرقام نفسها؛ يجب أن تتطابق تماماً.
4. نفّذ: دين جديد بدفعة أولى، ثم دفعة، ثم عكسها، ثم «النسخ الاحتياطي الآن»، ثم وضع الطيران أثناء النسخ وإعادته، ثم الاسترجاع على الهاتف الثاني.
5. التطبيق الإداري: دخول المالك، تفعيل اشتراك تجريبي لحساب اختبار، ثم تحقق من ظهوره في تطبيق المستخدم.

**الرجوع:** لا ترحيل بيانات في 3.6.2. يمكن تثبيت 3.6.0 مجدداً فقط بإلغاء التثبيت، وهذا يمسح البيانات المحلية (Android يمنع تثبيت إصدار أقدم فوق أحدث). لذلك تأكد أن «آخر نسخة ناجحة» حديثة قبل أي رجوع، ثم استرجع من Drive.
