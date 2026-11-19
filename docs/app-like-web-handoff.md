# تسليم: إكمال «التطبيق نسخة طبق الأصل من sictm.net»

> هذا الملف برومت كامل لجلسة Claude Code جديدة. اقرأه كله قبل أي تعديل.
> آخر تحديث: 2026-11-15.

## المطلوب
تطبيق Flutter للعميل (`lib/`) يبقى **نسخة طبق الأصل** من موقع العميل sictm.net (`customer_web/`، React + Vite). يعني نفس الألوان والتصميم والتنظيم، وكل الصفحات **مبنية بـ Flutter**، ما WebView.

الخطة الكاملة في `docs/app-like-web-plan.md`، اقرأها أول حاجة. كل مرحلة بتبدأ بقراءة صفحة الموقع المقابلة في `customer_web/src/pages/*.tsx` و`components/*.tsx` وقواعدها في `customer_web/src/styles.css`. القواعد المتأخرة في آخر الملف (من حوالي السطر 700 لتحت) بتغيّر القديمة، مثلاً `.tile` زواياها 18 مش 28.

## قواعد المستخدم (إلزامية)
- **كل** رد ورسالة تقدّم، وخطوات قائمة المهام، وملخص الختام وأزراره: **بالعربي** (لهجة سودانية بسيطة).
- **ممنوع أي git commit أو push** لحدي ما المستخدم يقولها صراحة.
- ما تغيّر ولا تذكر أرقام الإصدارات (version/build number).
- استخدم `context.colors` في الويدجتس، ما `AppColors` مباشرة.
- الألوان من توكنات الموقع بالضبط، ما تخترع درجات.
- الإعدادات تفضل شاشة براها.
- ما تشغّل `dart format` على مجلد كامل. نسّق ملفات بعينها بس.
- الريبو بنهايات أسطر CRLF، فانتبه للاستبدال المتعدد الأسطر بالسكربتات.
- نشر موقع العميل مسموح بدون سؤال. أي نشر تاني (القواعد، الإدارة، الشركة) يحتاج موافقة.
- APK الإصدار لازم يتبنى بـ `--dart-define=PUSH_RELAY_URL=...`، وإلا الإشعارات بتتقفل بصمت. ما تبني APK إلا لما المستخدم يطلب.
- في جلسات تانية بتعدّل نفس الشجرة (محادثة الفني `lib/features/tech_chat/` و`customer_web` و`company_web`). **ما تلمس ملفاتها، وما تعمل commit لشغلها.**
- لما استهلاك الـ5 ساعات يوصل 90%: كمّل الخطوة الحالية، احفظ الحالة في هذا الملف، وقيف وبلّغ.
- بين المراحل ما تسأل، كمّل. الحدود الصارمة: ما في commit، وما في نشر غير الموقع.

## الحاصل لحدي هسي (غير محفوظ في git)
- **المرحلة 1، الألوان:** `lib/core/theme/app_colors.dart` فيه توكنات الموقع: الكحلي `#063B73`، الأخضر `#1FA35C` (action)، `navBar`، و`heroStart/Mid/End`. فيه برضو `app_theme.dart` و`app_dimensions.dart` (`AppRadius.button=14`، `field=12`، `card=16`، و`AppSize.button=50`).
- **المرحلة 2، الهيكل:**
  - `customer_dashboard_screen.dart` فيه `SiteBar` كحلي وشريط صفحات: `enum CustomerSection { home, products, services, companies, orders, chats }`.
  - الزائر بيتصفّح بدون حساب. `lib/features/auth/presentation/require_account.dart` فيه `openSignIn` و`requireAccount`.
- **المرحلة 3، الرئيسية:** المجلد `lib/features/customer_dashboard/presentation/site/`:
  - `site_look.dart`: ألوان الأقسام وإيموجيها، وكل قطع الشكل: `SiteCard`، `SiteChip`، `SiteMenuPill`، `SitePageSearch`، `SiteEmptyState`، `SiteActionPill`، `SitePriceText`، `SiteRatingLine`، `SiteGrid`، `SitePill`، `sitePrice`.
  - `site_cards.dart`: `SiteProductCard` (شبكة أو قائمة)، `SiteCompanyCard`، `SiteServiceCard`، `SiteCategoryCard`.
  - `site_hero_offers.dart` و`site_home.dart`: `SiteHomePage` و`SiteFooter`، وفي الذيل «بوابة الفني».
- **المرحلة 4، التصفّح:**
  - `site_browse.dart`: `SiteBrowsePage` للمنتجات والخدمات بالفلاتر والترتيب، وزر الشبكة أو القائمة محفوظ في prefs.
  - `site_companies.dart`: `SiteCompaniesPage`.
  - شاشة البحث بقت بكروت الموقع.
- **الاختبارات:** `test/site_home_test.dart` و`test/site_browse_test.dart` و`test/helpers/home_pages.dart`. آخر تشغيل: `flutter analyze` نظيف، و1130 اختبار نجحت.
- **الموقع (منشور):** العروض المتحركة بالعدّ التنازلي في الرئيسية: `customer_web/src/components/HeroOffers.tsx` و`.css`، و`data/heroOffers.ts`.

## المرحلة 5 (اتبنت 2026-11-15، غير محفوظة في git)
**الحاصل فيها:**
- `site/site_detail_parts.dart` فيه: `SiteCrumbs` بفاصل ‹ أو ›، و`SiteTile` و`SiteTileTitle` و`SiteProseTile` و`SiteProse`، و`SiteStatusPill` و`SiteLinePill` و`SiteShareButton` (بيشارك `https://sictm.net/...` بـshare_plus)، و`SiteNote` و`SiteCompanyBox` و`SiteSpecs` و`SiteReviews` و`siteIsoDate`. فيه برضو `siteShopRequestProvider` و`siteOpenShop`: مسار الأقسام بيرجّع الـshell لصفحة المنتجات أو الخدمات على القسم.
- `site/site_compare.dart` فيه: `siteCompareProvider` (المفتاح `compare-products`، أقصى حد 3)، و`SiteCompareButton` (دائرة على الكرت أو حبّة في صفحة المنتج)، و`SiteCompareBar`، و`SiteComparePage`.
- `product_details_screen.dart` و`service_details_screen.dart` و`service_offer_card.dart` و`company_details_screen.dart` و`product_gallery.dart` (صور مصغّرة 64) اتبنوا بترتيب الموقع، والمنطق القديم زي ما هو.
- شريط المقارنة في أسفل الـshell (ما عدا المحادثات) وفي شاشة البحث. الـshell فيه `_servicesCategory` جديد.
- العرض الما عنده سعر بقى «تواصل لمعرفة السعر» زي الموقع، فاتعدّلت 3 توقعات في `test/product_price_test.dart` و`test/services_and_chat_test.dart`.
- 31 مفتاح جديد `site*` في l10n. `test/site_details_test.dart` فيه 15 اختبار. `flutter analyze` نظيف، و1145 اختبار نجحت.
- اتعمل APK debug وبُني بنجاح، فـshare_plus شغّال في أندرويد. صور المقارنة بالموقع في `build/app-like-web/` (13–15).

## المرحلة 6 (اتبنت 2026-11-15، غير محفوظة في git)
- `site/site_orders.dart` فيه: `SiteOrdersPage` («طلباتي»: منتجات أو خدمات بالعدد، وبحث داخل الصفحة، والكل/جارية/منتهية، وكروت الموقع)، و`siteNarrowOrders` و`siteNarrowRequests`، و`SiteTone` و`SiteTonePill`، و`SiteSegment`، و`SitePageTitle`. الـshell بيعرضها بدل `CustomerOrdersTab` (القديم لسه موجود، ينضّف في المرحلة 10).
- `site_detail_parts.dart` زاد فيه: `SiteSection` (بلاطة بعنوان وحبّة حالة)، و`SiteSummary` (ملخص السعر بسطر الإجمالي الأخضر)، و`siteLongDate` («15 نوفمبر 2026»). `SiteNote` بقى يقبل عنوان فاضي.
- `checkout_screen.dart`: نفس المنطق بشكل الموقع: «الطلب من …»، والعنوان الكبير، وبلاطة المنتج، و`SiteSegment` للتوصيل أو الاستلام والتركيب، وملخص السعر، وزر «تأكيد الطلب • المبلغ».
- `manual_payment_screen.dart`: بلاطة المبلغ، والملاحظة، و«حسابات الدفع»، وصندوق رفع الإيصال، والتنبيه الأصفر، و«تعديل بيانات الطلب» (بيرجع لإتمام الطلب).
- `order_details_screen.dart`: اتغيّر الشكل بس (`SiteSection`، والعنوان، وحبّة الحالة، والمنتج بالمواصفات، و`SiteSummary`). كلاس `_TechnicianContact` بتاع جلسة الفني ما اتلمس.
- `service_request_details_screen.dart`: العميل بيشوف بلاطات الموقع وعنوان «طلب خدمة #…»، والشركة بتشوف كروتها القديمة (`asCompany`). `service_request_form_screen.dart` بقى بشكل الموقع.
- 14 مفتاح l10n جديد. `test/site_orders_test.dart` فيه 11 اختبار. `flutter analyze` نظيف، و1156 اختبار نجحت. صور الشاشات من `test/visual/screens_dump_test.dart` في `build/app-like-web/phase6/`.
- **ملاحظة:** صفحات الطلب ما بتتصوّر من الموقع الحي لأنها محتاجة تسجيل دخول، فالمقارنة كانت بالكود وبصور الاختبار.

**المصادر في الموقع:**
- `customer_web/src/pages/ProductPage.tsx`، `ServicePage.tsx`، `CompanyPage.tsx`، `ComparePage.tsx`.
- `customer_web/src/components/Compare.tsx` و`ShareButton.tsx` و`ReviewsSection.tsx` و`Bits.tsx` (`Breadcrumbs`، `CityTag`، `PriceText`).
- `customer_web/src/data/compare.tsx` و`compareTable.ts`.

**شاشات التطبيق اللي بتتعدّل** (حافظ على منطقها: المخزون الحي، `requireAccount`، `chooseDeliveryCity`، `ContactCompanyButton`، والـcheckout):
- `lib/features/products/presentation/product_details_screen.dart`
- `lib/features/services/presentation/service_details_screen.dart` و`widgets/service_offer_card.dart`
- `lib/features/companies/presentation/company_details_screen.dart`
- `lib/features/products/presentation/widgets/product_gallery.dart`: خليها تقبل السحب (الاختبار `test/product_images_test.dart` بيسحب `ValueKey('product-gallery')` وبيعدّ `AnimatedContainer`)، وزيد صور مصغّرة 64px تحتها زي `.thumbs`، أو عدّل الاختبار.

**قطع جديدة مقترحة** (ملف `site/site_detail_parts.dart`):
- **`SiteCrumbs`:** انقل `_Crumbs` من `site_browse.dart` وخليه عام. الفاصل `‹` في العربي و`›` في الإنجليزي (`PATH_SEPARATOR`)، ما `/`.
- **`SiteTile`:** خلفية surface، حد 1px لون `borderDefault`، زوايا 18، padding 28.
- **العنوان داخل البلاطة:** 22 بوزن w800.
- **حبّة الحالة:** `.status.ok` و`.status.off`.
- **`SiteShareButton`:** حبّة بارتفاع 38، padding 14، وحد خفيف. بيشارك `https://sictm.net/product/<id>`.
- **`.note`:** للتركيب. فيها أيقونة مفتاح، وخلفيتها `bgSubtle`، وزواياها 18.
- **`.company-box`:** شعار 48 مع الاسم والتقييم وسهم، وزواياها 16.
- **قائمة المواصفات `.specs`.**
- **`SiteReviews`:** بشكل `ReviewsSection` في الموقع:
  - المتوسط بخط 40، والنجوم، والعدد؛
  - صورة دائرية فيها أول حرف، و«عميل مؤكَّد» بالأخضر؛
  - التاريخ بصيغة `yyyy-mm-dd`، والوسوم، والتعليق؛
  - رد الشركة في `blockquote`؛
  - 3 تقييمات ظاهرة، وبعدها «عرض كل التقييمات (n)».

  التطبيق عنده `reviewTagLabel` ومفاتيح `review*` في l10n، والمصدر `targetReviewsProvider(id)` و`companyPublicReviewsProvider(id)`.

**صفحة المنتج** (على الجوال: `.product-media` بنسبة 16/10، و`.product-info h1` بخط 26). الترتيب من فوق لتحت:
1. مسار الأقسام: «كل الأقسام ‹ … ‹ الاسم».
2. الصورة. لو ما في صورة: تدرّج بلون القسم وإيموجي، وفوقها حبّة العرض.
3. الصور المصغّرة.
4. حبّة «متوفر (n)» أو «غير متوفر في المخزون».
5. العنوان، وجنبه زر المفضلة.
6. سطر التقييم.
7. صف الأزرار: «أضف للمقارنة» و«مشاركة».
8. حبّات الماركة ومسار القسم.
9. السعر بخط 28 بالأخضر، والسعر القديم مشطوب.
10. «ينتهي في …» بالأحمر.
11. صندوق الشركة.
12. حبّة المدينة («تخدم: …»). خلي `DeliveryCityBanner` بتاع التطبيق لأنه مربوط بمدينة التوصيل.
13. ملاحظة التركيب.
14. بلاطة «الوصف».
15. بلاطة «المواصفات».
16. التقييمات.

**صندوق الشراء** ثابت في أسفل الشاشة (`.buy-box`: زوايا 18 وظل). فيه:
- العدّاد، و«الإجمالي» مع المبلغ؛
- «تواصل» (حدود فقط، أو أخضر لو ما في شراء)، و«اشترِ الآن» أخضر.

**الاختبارات اللازم تفضل شغالة:**
- `test/product_price_test.dart`: النص `'1,000 SDG'` لازم يظهر مرتين، و`find.byIcon(Icons.add)` في العدّاد.
- `test/product_brand_test.dart`: `ValueKey('product-brand')`.
- `test/contact_company_test.dart` و`stock_test.dart` و`customer_search_test.dart` و`services_and_chat_test.dart` و`home_redesign_test.dart`.
- `test/visual/screens_dump_test.dart`.

**صفحة الخدمة:**
- مسار الأقسام.
- بلاطة فيها العنوان (30 بوزن w800) وجنبه المفضلة، وتحتها الوصف.
- «الشركات المتاحة».
- كرت لكل عرض:
  - صف الشركة: الشعار، والاسم، والتقييم بدون العدد، و« · المدينة»؛
  - السعر، أو «تواصل لمعرفة السعر»؛
  - الملاحظة، وحبّة المدينة؛
  - «تواصل» (حدود) و«اطلب الخدمة» (أخضر)، والاتنين بعد `requireAccount`.
- الترتيب: الشركات البتخدم مدينة العميل أول، وبعدها بالاسم.

**صفحة الشركة:**
- بلاطة الرأس:
  - الشعار 88، والاسم بخط 28، والتقييم؛
  - الحقائق: 📍 العنوان أو المدينة، والهاتف بالإنجليزي ويفتح `tel:`، و«عرض على الخريطة» إذا في إحداثيات (التطبيق عنده `CompanyLocationBlock` وتطبيق الخرائط)؛
  - حبّة المدينة.
- بلاطة «نبذة عن الشركة».
- التقييمات.
- «المنتجات (n)» في شبكة `SiteProductCard`.

**المقارنة:**
- **المخزن:** Notifier بـ SharedPreferences، المفتاح `compare-products`، وحده الأقصى 3. لو القائمة مليانة: رسالة «تقارن حتى 3 منتجات في المرة. أزل منتجًا أولًا.». المنتج اللي ما بقى معروض للبيع بيطلع من القائمة.
- **زر ⚖:**
  - في `SiteProductCard`: على الصورة تحت القلب (`top: 52`، `end: 8`)، دائرة 38. لما يكون مختار: خلفية كحلية وأيقونة بيضاء.
  - في صفحة المنتج: حبّة فيها نص «أضف للمقارنة» أو «إزالة من المقارنة».
- **شريط المقارنة:** يظهر أسفل الـshell وشاشة البحث لما يكون في منتج مختار، وما يظهر في صفحة المقارنة والمحادثات. فيه:
  - «⚖ n/3»، والأسماء (بتختفي على الجوال)؛
  - «قارن الآن»، أو «اختر منتجًا آخر» لو المختار أقل من اتنين؛
  - «✕» تمسح المقارنة.
- **صفحة المقارنة:**
  - العنوان «مقارنة المنتجات»، وجنبه «مسح المقارنة»؛
  - جدول يتمرر بالعرض (أقل عرض 560، وعمود العناوين 150)؛
  - الصفوف: السعر (الأرخص بخلفية خضراء)، الشركة، الماركة، القسم، التقييم، التوفر، التوصيل، التركيب، وبعدها كل المواصفات؛
  - في الأسفل: «الأخضر هو الأقل سعرًا…»؛
  - لو المختار أقل من منتجين: حالة فاضية.

**التنقّل من الصفحات المفتوحة للـshell:** مسار الأقسام بيرجع لصفحة المنتجات على قسم معيّن. اعمل `NotifierProvider` زي `companyHomeRequestProvider` في `company_admin_shell.dart`:
- الـshell يسمع له، ويعيّن `_productsCategory` والقسم؛
- الصفحة تعمل `popUntil(isFirst)`.

**l10n:**
- ضيف المفاتيح في `lib/l10n/app_ar.arb` و`app_en.arb`، وشغّل `flutter gen-l10n`.
- أي مفتاح نصّه واحد في اللغتين ضيفه لـ`sameOnPurpose` في `test/localization_test.dart`.

**بعد البناء:**
- اختبارات جديدة في `test/site_details_test.dart`. تشمل عدم الخروج من الشاشة في عرض 320 مع خط كبير، والمقارنة بحدها الأقصى.
- `flutter analyze`، وبعدها `flutter test`.
- مقارنة بالصور: ابنِ Flutter web release وقدّمه على المنفذ 8081 (`.claude/launch.json` فيه `flutter-web-static`). صوّره بعرض 390 جنب sictm.net، فاتح وداكن، عربي وإنجليزي، واحفظ الصور في `build/app-like-web/`.

## المرحلة 7 (اتبنت 2026-11-15، غير محفوظة في git)
- **المحادثات:** قائمة العميل فوقها العنوان والبحث و«الكل/غير المقروءة» (`siteNarrowChats`). قائمة الشركة زي ما هي. رسالة العميل جنبها ✓ لما تتبعت و✓✓ لما الشركة تقراها (`readByOther` في `message_bubble.dart`، إضافة بس، وشغل جلسة الفني `mineLabel` ما اتلمس).
- **الإشعارات:** عنوان، وبلوك واحد مدوّر فيه الصفوف. **المفضلة:** كروت المنتجات، وبعدها الخدمات، وبعدها العناصر الما بقت متاحة.
- **حسابي:** بلاطة فيها الصورة والاسم والبريد، وبعدها صفوف (`SiteRows` و`SiteRow`): الهاتف، ومدينتي، وتعديل الملف، وكلمة المرور، والمفضلة، والإعدادات، والإشعارات، وزر تسجيل الخروج.
- **الإعدادات:** عناوين المجموعات والزوايا بقت زي الموقع. الشاشة مشتركة مع الشركة والفني، فما اتغيّر غير الشكل.
- **الدخول والتسجيل ونسيت كلمة المرور:** بقوا داخل `SiteAuthCard` (`site/site_auth.dart`).
- **الشروط والأحكام:** صفحة في التطبيق (`site/site_terms.dart`، بتقرا `platform_settings/terms`)، والذيل بيفتحها.
- `test/site_account_test.dart` فيه 10 اختبارات، واتعدّلت توقعات في `localization_test` و`push_kinds_test` و`reports_test` و`services_and_chat_test` و`customer_logout_test`. آخر تشغيل (2026-11-18): `flutter analyze` نظيف، و1166 اختبار نجحت.
- **الموافقة على الشروط (اتعملت 2026-11-18 بموافقة المستخدم):**
  - التسجيل فيه مربع «أوافق على الشروط والأحكام» لما تكون في شروط منشورة، وما بيسمح بإنشاء الحساب بدونه.
  - الإصدار بيمشي مع الحساب: `signUpWithEmail(termsVersion:)`، وبعدها `createCustomerProfile`، والملف بيتكتب فيه `termsVersion` و`termsAcceptedAt`.
  - `SiteTermsGate` في `auth_gate.dart`، للعملاء بس: أي زول ما وافق على الإصدار المنشور بيشوف الشروط ومربع و«أوافق وأتابع» أو «تسجيل الخروج». بيكتب الموافقة بـ`siteTermsAcceptorProvider` وبيعيد تحميل الملف.
  - `UserProfile.termsVersion` اتضاف.
  - القواعد الحية (`4311c3f9…`) نفس الملف المحلي وبتسمح بالحقلين، فما في حاجة لنشر.
  - `test/site_terms_test.dart` فيه 7 اختبارات. 1173 اختبار نجحت.
  - **ما اتجرّب على Firebase حقيقي**، لأن الكتابة الحية محتاجة حساب.
- **الما اتعمل في المرحلة 7:**
  - «بلاغاتي» بشكل الموقع، لأنها مشتركة مع الشركة.
  - صور المرحلة.

## المرحلة 8 (منشورة 2026-11-18 على company.sictm.net و admin.sictm.net، غير محفوظة في git)
- **لوحة الشركة** (`company_web/src/styles.css`):
  - كتلتي الألوان (فاتح وداكن) اتبدلوا بتوكنات `customer_web/src/styles.css`، واتضافت `--action` و`--price` و`--nav-bg`.
  - في آخر الملف: الزر الرئيسي (`.btn.p`) أخضر، والشريط العلوي (`.top`) كحلي، فيه بحث أبيض وأزرار شفافة، والزوايا 14 و18.
  - `index.html`: `theme-color` بقى `#063B73`.
- **لوحة الإدارة** (`platform_admin_web/src/styles.v2.css`):
  - الكتل الأربعة (فاتح وداكن، وكل واحد مع نسخة إعداد الجهاز) أخدت ألوان الموقع، وأخدت درجات الضغط من `app_colors.dart`. السكربت في scratchpad `admin_tokens.mjs`.
  - الأساسي في الداكن كحلي `#063b73` زي التطبيق، لأن الأبيض على `#4a90e2` بيدي 3.3:1 بس.
  - خلفيات النجاح والتحذير في الداكن اتخلّت مصمتة، لأن اختبار التباين محتاج hex.
  - `styles.v2.components.css`: أزرار `.btn--primary` و`.ds-btn--primary` خضراء، والضغط عليها `#188a4d`.
  - `styles.v2.tokens.test.ts` اتعدّل للألوان الجديدة. ملف `styles.css` القديم ما اتلمس.
- **الفحص:**
  - الإدارة: 941 اختبار نجحت، والشركة: 46.
  - اللوحتين اتبنوا في scratchpad.
  - صورة صفحة دخول الشركة (فاتح وداكن) في `build/app-like-web/phase8/`.
  - ما اتصوّرت الشاشات من جوه، لأنها محتاجة تسجيل دخول.
- **النشر (2026-11-18 بموافقة المستخدم):** اللوحتين اتنشروا من الشجرة الحالية، ومعاهم Performance Monitoring بتاع 2026-11-17 الكان منتظر النشر. ما في روابط للمحاكي في dist. اتأكدت من الموقعين الحيين: الأزرار خضراء، وما في أخطاء في الـconsole.

## المرحلة 10: التنظيف (اتعمل 2026-11-18، غير محفوظ في git)
- اتمسحت 28 ملف في `lib/` ما كان في أي ملف بيوصل ليها من `main.dart`: الرئيسية القديمة (`DashboardHomeTab` و`home_*`)، و`CategoryScreen` و`category_browser`، والكروت القديمة (`ProductCard` و`ProductGridCard` و`ServiceCard` و`CompanyCard` و`OrderCard`)، و`CustomerOrdersTab` و`CustomerOrdersScreen` و`ServiceRequestsList`، وشاشات placeholder قديمة.
- `SiteCategoryCard` بقى من غير `onOpen` بيفتح صفحة المنتجات على القسم (`siteOpenShop`)، بدل `CategoryScreen`.
- كرت الطلب الجديد بقى عام (`SiteOrderCard`)، واختبارات الطلبات اتنقلت ليه.
- اختبارات ترتيب مدينة العميل اتنقلت لـ`siteSortProducts`.
- اتمسحت 5 ملفات اختبار كانت بتختبر الحاجات المحذوفة بس: `category_screen_test`، و`category_browser_test`، و`home_hero_autoplay_test`، و`helpers/home_pages.dart`، و`visual/home_dump_test`.
- من الاختبارات المتبقية اتشالت المجموعات القديمة: الكروت والرئيسية والعدّاد القديم. البدائل في `test/site_*`.
- `flutter analyze` نظيف، و1097 اختبار نجحت (كانت 1173 قبل حذف اختبارات الشغل القديم). سكربت scratchpad `dead_files.mjs` بيقول: ما في ملف في `lib` ما بيوصل ليه أي ملف.
- **ما اتشالت مفاتيح l10n القديمة**، لأنها كتيرة وما بتأثّر على التطبيق.

## بحث الأخطاء (2026-11-18، غير محفوظ في git)
- **شريط المقارنة كان مغطي الشاشة كلها:** `Align` من غير `heightFactor` كان بيتمدد لكل الارتفاع. اتصلح، واتضاف اختبار للارتفاع. جرّبت إن الاختبار بيفشل من غير الإصلاح (2388 بدل أقل من 100).
- **المقارنة كانت بتتمسح عند فتح التطبيق:** لو المنتجات وصلت قبل الشركات، القائمة بتطلع فاضية فالمنتجات بتتشال من المقارنة. هسي `siteCatalogueLoaded` بينتظر الاتنين، واتضاف اختبار.
- **«SDG» ثابتة في صفحات طلب العميل:** كانت في رسوم التوصيل والتركيب والإجمالي في صفحة الطلب وصفحة «تم إرسال طلبك»، وفي سعر طلب الخدمة للعميل. بقت `sitePrice`: «ج.س» في العربي. نص `orderTypeInstallation` و`pendingInstallationIncluded` ما بقى فيه عملة ثابتة.
- **شكلي، ما اتصلح:** «Request service» بيلف لسطرين في كرت العرض بعرض 390. السبب حشوة `AppButton` (20)، وتغييرها بيأثّر على كل أزرار التطبيق.
- جربت التطبيق في المتصفح كزائر: الرئيسية، والمنتجات، وصفحة المنتج ومسارها، والخدمات وصفحتها، والشركات وصفحتها، والمقارنة. ما في أخطاء في الـconsole.
- 1098 اختبار نجحت، والتحليل نظيف.

## زر «حمّل التطبيق»: منشور (2026-11-19)
- **منشور بعد ما الإشعارات جهزت وبموافقة المستخدم («انشر»):**
  - APK بالـrelay اترفع كـ`sictm.apk` على release `android-app` (الأحدث) في `moazar-mohamed/sudan-it-marketplace`، والرابط الثابت بيرجّع 200 و48 ميقا. السكربت في scratchpad `release_apk.mjs` بيبدّل الملف بنفس الاسم، فأي APK جاي بيترفع بيه والرابط ما بيتغيّر.
  - sictm.net (build `mwn4iyqj`) اتنشر من نسخة جلسة الإشعارات (SICTM `3107cd6` + العروض المتحركة + الإشعارات + SEO)، وفوقها الزر بالسكربت `app_button.mjs`.
  - الزر كمان في `customer_web` المحلي.
  - **اتدمج في SICTM `main` (`044dac6`، 2026-11-19، بموافقة المستخدم):** الزر والعروض المتحركة والإشعارات. فأي نشر من SICTM بيحافظ عليهم.

### الكان مكتوب قبل النشر
- **المستخدم قال: ما يترفع قبل ما الإشعارات تجهز.** يعني لازم الـrelay يتنشر الأول، وده محتاج Cloudflare token جديد من المستخدم.
- **المكان المختار:** إصدارات `moazar-mohamed/sudan-it-marketplace`، لأنه عام. SICTM خاص، والملف هناك ما بيتحمّل للزوار. الرابط الثابت المقترح: `https://github.com/moazar-mohamed/sudan-it-marketplace/releases/latest/download/sictm.apk`، والوسم بدون رقم إصدار.
- **الموقع:** sictm.net بيتنشر من SICTM `main` (`3107cd6`)، وفوقه العروض المتحركة المحلية. الزر لازم يتبني على نسخة نظيفة من SICTM `main`، زائد ملفات العروض الأربعة، والسطور في `HomePage.tsx` ونصوصها، والزر.
  - **الزر:** `<a className="icon-btn nav-app">` قبل `LanguageButton` في `Shell.tsx`، فيه أيقونة `download` جديدة و«حمّل التطبيق».
- **APK:** اتبنى إصدار بالـrelay (`app-release.apk`، 46 ميقا) في `build/app/outputs/flutter-apk/`، وما اترفع. لما تجهز الإشعارات، ابنيه تاني من الشجرة وقتها.

## المراحل الباقية بعد 8 **الحساب والباقي:**
   - المحادثات: بحث، غير المقروءة، «قرأتها الشركة»؛
   - الإشعارات، والمفضلة، وحسابي، والإعدادات، وبلاغاتي؛
   - الشروط والأحكام والموافقة عليها؛
   - الدخول والتسجيل ونسيت كلمة المرور.
8. **ألوان لوحة الشركة** (`company_web/`) **ولوحة الإدارة** (`platform_admin_web/`): بتوكنات `customer_web/src/styles.css`. نشرهم يحتاج موافقة المستخدم.
9. **زر «حمّل التطبيق» في موقع العميل:** كان في شريط التنقّل في الموقع القديم. **ينتظر قرار المستخدم** في مكان استضافة ملف APK (47.8 ميقا). Firebase Spark بيسمح بحوالي 7 تحميلات في اليوم، وما في Storage.
10. **تنظيف:** `DashboardHomeTab` و`CategoryScreen` وويدجتس `home_*` القديمة ما مستعملة في الـshell، لكن الاختبارات وأزرار أقسام البحث لسه بتستعملها.
11. **في النهاية** (بس لما المستخدم يقول): commit لشغل هذه الخطة **فقط**، وبعدها APK جديد بـ`PUSH_RELAY_URL`.

## تنبيه للمستخدم
APK اتبنى يوم 2026-11-14 من جلسة محادثة الفني، وفيه تعديلات التصميم الما كانت خلصت وقتها. ما يتوزّع قبل بناء نسخة جديدة.
