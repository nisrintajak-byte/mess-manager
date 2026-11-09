#!/usr/bin/env python3
"""Builds the Kuwait / GCC section of tech.utplgroup.com in English and Arabic:
website/tech/kuwait/index.html and website/tech/kuwait/ar/index.html.

All text lives in TEXT and PRODUCTS below, so both languages always have the same layout.
To show another existing product in Kuwait, add one entry to PRODUCTS and run:
    python3 scripts/build-kuwait-pages.py
Kuwait contact details are placeholders until the company gives them (footer + KW_WHATSAPP
in website/tech/assets/kuwait.js). Never put India address, GST or India phone numbers here."""
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'website/tech/kuwait'
e = html.escape

# Small line icons for "Who it's for" (stroke = currentColor).
ICONS = {
    'shop': '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/><path d="M10 20v-4h4v4"/>',
    'restaurant': '<path d="M7 3v7a2 2 0 0 0 4 0V3"/><path d="M9 10v11"/><path d="M17 21V3c-2 1-3 4-3 7h3"/>',
    'salon': '<circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.1 16L20 4"/><path d="M15.9 16L4 4"/>',
    'school': '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>',
}
WA_ICON = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 '
           '10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8'
           '-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5'
           'a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1'
           '.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>')

TEXT = {
    'en': {
        'dir': 'ltr', 'path': '/kuwait/',
        'title': 'Uyoon Tech Solutions · Kuwait and the GCC',
        'desc': 'Apps for families and businesses in Kuwait and the GCC, in English and Arabic: Mess Manager and Uyoon Al Wasel.',
        'brand_sub': 'Kuwait · GCC',
        'nav': [('#products', 'Products'), ('#why', 'Why us'), ('#contact', 'Contact')],
        'region_label': 'Choose region', 'india': 'India', 'kuwait': 'Kuwait',
        'lang_label': 'Language',
        'eyebrow': 'Kuwait · GCC',
        'h1': 'Smart apps for Kuwait, <em>in Arabic and English.</em>',
        'lead': 'Simple, private apps for families, shops, restaurants, salons and schools across Kuwait and the GCC. Every app works fully in Arabic and English, and keeps your data private.',
        'cta_products': 'See our products', 'cta_wa': 'Chat on WhatsApp',
        'trust': ['Full Arabic and English', 'Your data stays private', 'Support for Kuwait'],
        'products_eyebrow': 'Our products', 'products_h2': 'Products for Kuwait',
        'products_p': 'Products already built by Uyoon Tech Solutions, ready for Kuwait and the GCC. Book a free demo for your business.',
        'features': 'Key features', 'for': "Who it's for",
        'tags': {'shop': 'Shop', 'restaurant': 'Restaurant', 'salon': 'Salon', 'school': 'School'},
        'demo': 'Get a demo', 'more': 'Learn more',
        'why_eyebrow': 'Why Uyoon Tech', 'why_h2': 'Built for the GCC from day one',
        'why': [
            ('Arabic first', 'Right-to-left screens, Arabic fonts and numbers done properly, not as an afterthought.'),
            ('Privacy first', 'Phone numbers and personal details are never shown to strangers or sold to advertisers.'),
            ('Nothing changes quietly', 'Important actions are recorded, so records cannot be rewritten without a trace.'),
        ],
        'c_eyebrow': 'Contact', 'c_h2': 'Book a demo in Kuwait',
        'c_p': 'Leave your details and our team will contact you on WhatsApp to set up a free demo for your business.',
        'c_points': ['Free demo, no commitment', 'Arabic or English, as you prefer', 'Reply on working days'],
        'f_name': 'Name', 'f_mobile': 'Mobile', 'f_company': 'Company', 'f_city': 'City',
        'ph_name': 'Your full name', 'ph_mobile': '5X XXX XXX', 'ph_company': 'Company or shop name', 'ph_city': 'e.g. Kuwait City, Hawalli, Salmiya',
        'cities': ['Kuwait City', 'Hawalli', 'Salmiya', 'Farwaniya', 'Jahra', 'Ahmadi', 'Fahaheel', 'Mubarak Al-Kabeer', 'Mangaf', 'Jabriya'],
        'submit': 'Send request', 'or': 'or', 'wa': 'WhatsApp us',
        'demo_for': 'Demo for:',
        'msg_demo': 'Thank you. This is the demo version: the form will send to our Kuwait WhatsApp once the number is added.',
        'msg_sent': 'Thank you. WhatsApp has opened with your details. Press Send and we will reply soon.',
        'wa_pending': 'Kuwait WhatsApp number: [To Be Updated]',
        'wa_hello': 'Hello Uyoon Tech, I would like a demo.',
        'wa_intro': 'Demo request from tech.utplgroup.com/kuwait',
        'l_product': 'Product',
        'foot_tag': 'Software for everyday life in Kuwait and the GCC.',
        'foot_products': 'Products', 'foot_help': 'Help',
        'foot_contact': 'Contact', 'foot_demo': 'Book a demo',
        'reg': [('Company Name', None), ('Address', None), ('Email', None), ('Phone', None)],
        'tbu': '[To Be Updated]',
        'copy': '© 2026 Uyoon Tech Solutions. All rights reserved.',
        'privacy_note': "Each product's privacy policy and terms are on its own page.",
    },
    'ar': {
        'dir': 'rtl', 'path': '/kuwait/ar/',
        'title': 'عيون تك سوليوشنز · الكويت والخليج',
        'desc': 'تطبيقات للعائلات والأعمال في الكويت ودول الخليج بالعربية والإنجليزية: مدير المصروفات وعيون الوصل.',
        'brand_sub': 'الكويت · الخليج',
        'nav': [('#products', 'المنتجات'), ('#why', 'لماذا نحن'), ('#contact', 'تواصل معنا')],
        'region_label': 'اختر المنطقة', 'india': 'الهند', 'kuwait': 'الكويت',
        'lang_label': 'اللغة',
        'eyebrow': 'الكويت · الخليج',
        'h1': 'تطبيقات ذكية للكويت، <em>بالعربية والإنجليزية.</em>',
        'lead': 'تطبيقات بسيطة وآمنة للعائلات والمحلات والمطاعم والصالونات والمدارس في الكويت ودول الخليج. كل تطبيق يعمل بالكامل بالعربية والإنجليزية ويحافظ على خصوصية بياناتك.',
        'cta_products': 'تعرّف على منتجاتنا', 'cta_wa': 'تواصل عبر واتساب',
        'trust': ['عربي وإنجليزي بالكامل', 'بياناتك تبقى خاصة', 'دعم للكويت'],
        'products_eyebrow': 'منتجاتنا', 'products_h2': 'منتجات للكويت',
        'products_p': 'منتجات جاهزة من عيون تك سوليوشنز، مهيأة للكويت ودول الخليج. احجز عرضاً تجريبياً مجانياً لعملك.',
        'features': 'أهم المزايا', 'for': 'لمن هذا المنتج',
        'tags': {'shop': 'محل', 'restaurant': 'مطعم', 'salon': 'صالون', 'school': 'مدرسة'},
        'demo': 'اطلب عرضاً تجريبياً', 'more': 'اعرف المزيد',
        'why_eyebrow': 'لماذا عيون تك', 'why_h2': 'مصمّمة للخليج منذ اليوم الأول',
        'why': [
            ('العربية أولاً', 'شاشات من اليمين إلى اليسار وخطوط وأرقام عربية مضبوطة، لا كإضافة لاحقة.'),
            ('الخصوصية أولاً', 'لا تُعرض أرقام الهواتف والبيانات الشخصية للغرباء ولا تُباع للمعلنين أبداً.'),
            ('لا شيء يتغيّر بصمت', 'الإجراءات المهمة مسجّلة، فلا يمكن تعديل السجلات دون أثر.'),
        ],
        'c_eyebrow': 'تواصل معنا', 'c_h2': 'احجز عرضاً تجريبياً في الكويت',
        'c_p': 'اترك بياناتك وسيتواصل معك فريقنا عبر واتساب لترتيب عرض تجريبي مجاني لعملك.',
        'c_points': ['عرض مجاني دون أي التزام', 'بالعربية أو الإنجليزية كما تفضّل', 'نرد في أيام العمل'],
        'f_name': 'الاسم', 'f_mobile': 'رقم الجوال', 'f_company': 'الشركة', 'f_city': 'المدينة',
        'ph_name': 'اسمك الكامل', 'ph_mobile': '5X XXX XXX', 'ph_company': 'اسم الشركة أو المحل', 'ph_city': 'مثال: مدينة الكويت، حولي، السالمية',
        'cities': ['مدينة الكويت', 'حولي', 'السالمية', 'الفروانية', 'الجهراء', 'الأحمدي', 'الفحيحيل', 'مبارك الكبير', 'المنقف', 'الجابرية'],
        'submit': 'أرسل الطلب', 'or': 'أو', 'wa': 'راسلنا على واتساب',
        'demo_for': 'عرض تجريبي لـ:',
        'msg_demo': 'شكراً لك. هذه نسخة تجريبية: سيُرسل النموذج إلى واتساب الكويت بعد إضافة الرقم.',
        'msg_sent': 'شكراً لك. فُتح واتساب ببياناتك. اضغط إرسال وسنرد عليك قريباً.',
        'wa_pending': 'رقم واتساب الكويت: [سيتم التحديث]',
        'wa_hello': 'مرحباً عيون تك، أرغب في عرض تجريبي.',
        'wa_intro': 'طلب عرض تجريبي من tech.utplgroup.com/kuwait',
        'l_product': 'المنتج',
        'foot_tag': 'برمجيات للحياة اليومية في الكويت ودول الخليج.',
        'foot_products': 'المنتجات', 'foot_help': 'المساعدة',
        'foot_contact': 'تواصل معنا', 'foot_demo': 'احجز عرضاً تجريبياً',
        'reg': [('اسم الشركة', None), ('العنوان', None), ('البريد الإلكتروني', None), ('الهاتف', None)],
        'tbu': '[سيتم التحديث]',
        'copy': '© 2026 عيون تك سوليوشنز. جميع الحقوق محفوظة.',
        'privacy_note': 'سياسة الخصوصية والشروط لكل منتج في صفحته الخاصة.',
    },
}

# Only products that already exist on tech.utplgroup.com. Add new ones here when they launch.
PRODUCTS = [
    {
        'id': 'mess-manager', 'icon': '/assets/mess-manager-icon.png', 'link': '/mess-manager/',
        'for': ['shop', 'restaurant', 'salon'],
        'en': {
            'name': 'Mess Manager', 'alt': 'مدير المصروفات', 'pill': 'Android app · free',
            'desc': 'A shared notebook for the expenses of a staff room or shared flat. Add who paid and who shares, see who owes whom, and settle with proof that the Admin confirms.',
            'features': [
                ('Who owes whom', 'clear totals and the fewest payments to settle'),
                ('Payments need proof', 'upload a receipt, the Room Admin confirms it'),
                ('Every change is recorded', 'edits and deletions stay visible'),
                ('Need Requests', 'ask for gas, rice or cleaning and see who takes it'),
                ('Reports in KWD or any currency', 'PDF and CSV, works offline too'),
            ],
            'for_note': 'For staff who share a room and food: shop, restaurant and salon teams, and friends in a shared flat.',
        },
        'ar': {
            'name': 'مدير المصروفات', 'alt': 'Mess Manager', 'pill': 'تطبيق أندرويد · مجاني',
            'desc': 'دفتر مشترك لمصروفات سكن الموظفين أو الشقة المشتركة. سجّل من دفع ومن يشارك، واعرف من يدين لمن، وسوِّ الحساب بإثبات يؤكده المشرف.',
            'features': [
                ('من يدين لمن', 'إجماليات واضحة وأقل عدد من الدفعات للتسوية'),
                ('الدفعات تحتاج إثباتاً', 'ارفع الإيصال ويؤكده مشرف الغرفة'),
                ('كل تعديل مسجّل', 'التعديلات والحذف تبقى ظاهرة'),
                ('طلبات الاحتياجات', 'اطلب الغاز أو الأرز أو التنظيف وشاهد من يتكفّل بها'),
                ('تقارير بالدينار الكويتي أو أي عملة', 'PDF وCSV، ويعمل دون إنترنت أيضاً'),
            ],
            'for_note': 'للموظفين الذين يتشاركون السكن والطعام: فرق المحلات والمطاعم والصالونات، والأصدقاء في شقة مشتركة.',
        },
    },
    {
        'id': 'uyoon-al-wasel', 'icon': '/assets/uyoon-al-wasel-icon.png', 'link': 'https://wasel.utplgroup.com',
        'for': ['shop', 'restaurant', 'school'],
        'en': {
            'name': 'Uyoon Al Wasel', 'alt': 'عيون الوصل', 'pill': 'Web app · QR and NFC sticker',
            'desc': 'A smart QR and NFC sticker for every vehicle. Anyone who scans it can alert the owner without seeing a phone number, and in an emergency can call for help and alert family with the location.',
            'features': [
                ('Instant alerts', 'push, SMS and WhatsApp in seconds'),
                ('Private calls', 'neither side sees the other’s number'),
                ('Call chain', 'no answer? the driver or family is offered next'),
                ('SOS with live location', 'family is alerted in an emergency'),
                ('Fleet dashboard', 'all vehicles and alerts in one place'),
            ],
            'for_note': 'For delivery cars of shops and restaurants, school buses and staff cars, and every family car.',
        },
        'ar': {
            'name': 'عيون الوصل', 'alt': 'Uyoon Al Wasel', 'pill': 'تطبيق ويب · ملصق QR و NFC',
            'desc': 'ملصق ذكي بتقنية QR و NFC لكل مركبة. من يمسحه يمكنه تنبيه المالك دون رؤية رقم هاتفه، وفي الطوارئ يمكنه طلب المساعدة وتنبيه العائلة بالموقع.',
            'features': [
                ('تنبيهات فورية', 'إشعار ورسالة نصية وواتساب خلال ثوانٍ'),
                ('مكالمات خاصة', 'لا يرى أي طرف رقم الطرف الآخر'),
                ('سلسلة اتصال', 'لا رد؟ يُعرض السائق أو العائلة بعدك'),
                ('طوارئ مع موقع مباشر', 'تُنبَّه العائلة في حالات الطوارئ'),
                ('لوحة للأساطيل', 'كل المركبات والتنبيهات في مكان واحد'),
            ],
            'for_note': 'لسيارات التوصيل في المحلات والمطاعم، وحافلات المدارس وسيارات الموظفين، ولكل سيارة عائلية.',
        },
    },
]


def icon(name):
    return (f'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')


def product_html(p, lang, t):
    c = p[lang]
    feats = ''.join(f'<li><span><b>{e(h)}</b> · <span>{e(d)}</span></span></li>' for h, d in c['features'])
    tags = ''.join(f'<span class="for-tag">{icon(k)}{e(t["tags"][k])}</span>' for k in p['for'])
    ext = p['link'].startswith('http')
    target = ' target="_blank" rel="noopener"' if ext else ''
    more = f'<a class="btn btn-line" href="{p["link"]}"{target}>{e(t["more"])}</a>'
    alt_lang = 'ar' if lang == 'en' else 'en'
    return f'''      <article class="product" id="p-{p["id"]}">
        <div class="product-main">
          <span class="pill">{e(c["pill"])}</span>
          <div class="product-id">
            <img src="{p["icon"]}" alt="" width="64" height="64">
            <h3>{e(c["name"])}<span class="alt" lang="{alt_lang}">{e(c["alt"])}</span></h3>
          </div>
          <p>{e(c["desc"])}</p>
          <div class="hero-actions">
            <a class="btn btn-gold" href="#contact" data-demo="{e(c["name"])}">{e(t["demo"])}</a>
            {more}
          </div>
        </div>
        <div class="product-side">
          <div>
            <span class="mini-label">{e(t["features"])}</span>
            <ul class="features">{feats}</ul>
          </div>
          <div>
            <span class="mini-label">{e(t["for"])}</span>
            <div class="for-tags">{tags}</div>
            <p class="for-note">{e(c["for_note"])}</p>
          </div>
        </div>
      </article>'''


def page(lang):
    t = TEXT[lang]
    other = 'ar' if lang == 'en' else 'en'
    canonical = f'https://tech.utplgroup.com{t["path"]}'
    nav = ''.join(f'<a href="{h}">{e(x)}</a>' for h, x in t['nav'])
    products = '\n'.join(product_html(p, lang, t) for p in PRODUCTS)
    trust = ''.join(f'<li>{e(x)}</li>' for x in t['trust'])
    why = ''.join(f'<div class="card"><h3>{e(h)}</h3><p>{e(d)}</p></div>' for h, d in t['why'])
    points = ''.join(f'<li>{e(x)}</li>' for x in t['c_points'])
    cities = ''.join(f'<option value="{e(c)}">' for c in t['cities'])
    reg = ''.join(f'<dt>{e(k)}</dt><dd class="tbu">{e(t["tbu"])}</dd>' for k, _ in t['reg'])
    foot_products = ''.join(f'<a href="#p-{p["id"]}">{e(p[lang]["name"])}</a>' for p in PRODUCTS)
    data = {
        'msg-demo': t['msg_demo'], 'msg-sent': t['msg_sent'], 'wa-pending': t['wa_pending'], 'wa-hello': t['wa_hello'],
        'wa-intro': t['wa_intro'], 'demo-for': t['demo_for'], 'l-name': t['f_name'], 'l-mobile': t['f_mobile'],
        'l-company': t['f_company'], 'l-city': t['f_city'], 'l-product': t['l_product'],
    }
    data_attrs = ' '.join(f'data-{k}="{e(v)}"' for k, v in data.items())
    ar_fonts = '&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Kufi+Arabic:wght@600;700' if lang == 'ar' else ''
    return f'''<!doctype html>
<!-- Built by scripts/build-kuwait-pages.py. Edit the script, not this file. -->
<html lang="{lang}" dir="{t["dir"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(t["title"])}</title>
<meta name="description" content="{e(t["desc"])}">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="en" href="https://tech.utplgroup.com/kuwait/">
<link rel="alternate" hreflang="ar" href="https://tech.utplgroup.com/kuwait/ar/">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(t["title"])}">
<meta property="og:description" content="{e(t["desc"])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://tech.utplgroup.com/assets/mess-manager-icon.png">
<meta name="theme-color" content="#0B2540">
<link rel="icon" type="image/svg+xml" href="/assets/uyoon-tech-icon.svg">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@500;600{ar_fonts}&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/kuwait.css">
</head>
<body class="kw">
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="{t["path"]}">
      <img class="mark" src="/assets/uyoon-tech-mark.svg" width="46" height="46" alt="">
      <span><span class="brand-name" lang="en">Uyoon Tech Solutions</span><span class="brand-sub">{e(t["brand_sub"])}</span></span>
    </a>
    <nav class="nav" aria-label="Main">{nav}</nav>
    <div class="head-tools">
      <nav class="switch" aria-label="{e(t["region_label"])}"><a href="/">{e(t["india"])}</a><a href="{t["path"]}" aria-current="page">{e(t["kuwait"])}</a></nav>
      <nav class="switch" aria-label="{e(t["lang_label"])}"><a href="/kuwait/" lang="en"{' aria-current="page"' if lang == 'en' else ''}>EN</a><a href="/kuwait/ar/" lang="ar"{' aria-current="page"' if lang == 'ar' else ''}>عربي</a></nav>
    </div>
  </div>
</header>

<section class="hero">
  <div class="wrap">
    <span class="eyebrow">{e(t["eyebrow"])}</span>
    <h1>{t["h1"]}</h1>
    <p class="lead">{e(t["lead"])}</p>
    <div class="hero-actions">
      <a class="btn btn-gold" href="#products">{e(t["cta_products"])}</a>
      <a class="btn btn-ghost" href="#contact" data-wa>{e(t["cta_wa"])}</a>
    </div>
    <ul class="trust">{trust}</ul>
  </div>
</section>

<main>
  <section class="section" id="products">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">{e(t["products_eyebrow"])}</span>
        <h2>{e(t["products_h2"])}</h2>
        <p>{e(t["products_p"])}</p>
      </div>
      <div class="products">
{products}
      </div>
    </div>
  </section>

  <section class="section" id="why">
    <div class="wrap">
      <div class="section-head">
        <span class="eyebrow">{e(t["why_eyebrow"])}</span>
        <h2>{e(t["why_h2"])}</h2>
      </div>
      <div class="grid">{why}</div>
    </div>
  </section>

  <section class="section" id="contact">
    <div class="wrap cols-2">
      <div class="stack">
        <span class="eyebrow">{e(t["c_eyebrow"])}</span>
        <h2>{e(t["c_h2"])}</h2>
        <p>{e(t["c_p"])}</p>
        <ul class="trust" style="color:var(--muted);border-color:var(--line)">{points}</ul>
      </div>
      <form class="contact-box" id="kw-form" novalidate {data_attrs}>
        <p class="form-msg" id="kw-product-note" hidden></p>
        <div class="field">
          <label for="kw-name">{e(t["f_name"])}</label>
          <input id="kw-name" name="name" autocomplete="name" required minlength="2" maxlength="100" placeholder="{e(t["ph_name"])}">
        </div>
        <div class="field">
          <label for="kw-mobile">{e(t["f_mobile"])}</label>
          <div class="phone-in ltr"><span>+965</span><input id="kw-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel-national" required pattern="[0-9 ]{{8,11}}" maxlength="11" placeholder="{e(t["ph_mobile"])}"></div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="kw-company">{e(t["f_company"])}</label>
            <input id="kw-company" name="company" autocomplete="organization" required maxlength="120" placeholder="{e(t["ph_company"])}">
          </div>
          <div class="field">
            <label for="kw-city">{e(t["f_city"])}</label>
            <input id="kw-city" name="city" list="kw-cities" autocomplete="address-level2" required maxlength="60" placeholder="{e(t["ph_city"])}">
            <datalist id="kw-cities">{cities}</datalist>
          </div>
        </div>
        <input type="hidden" name="product" id="kw-product">
        <div class="hp" aria-hidden="true"><label>Website <input name="company_website" tabindex="-1" autocomplete="off"></label></div>
        <div class="form-actions"><button class="btn btn-gold" type="submit">{e(t["submit"])}</button></div>
        <p class="or-line">{e(t["or"])}</p>
        <div class="form-actions"><a class="btn btn-wa" href="#contact" data-wa>{WA_ICON}{e(t["wa"])}</a></div>
        <p class="form-msg" id="kw-form-msg" role="status" hidden></p>
      </form>
    </div>
  </section>
</main>

<footer class="site-foot">
  <div class="wrap">
    <div class="foot-cols">
      <div class="stack">
        <h3 class="foot-brand"><img src="/assets/uyoon-tech-mark.svg" width="32" height="32" alt=""><span lang="en">Uyoon Tech Solutions</span></h3>
        <p>{e(t["foot_tag"])}</p>
        <div class="register"><dl>{reg}</dl></div>
      </div>
      <div>
        <h3>{e(t["foot_products"])}</h3>
        {foot_products}
      </div>
      <div>
        <h3>{e(t["foot_help"])}</h3>
        <a href="#contact">{e(t["foot_demo"])}</a>
        <a href="#contact">{e(t["foot_contact"])}</a>
        <a href="/kuwait/{'ar/' if other == 'ar' else ''}" lang="{other}">{'عربي' if other == 'ar' else 'English'}</a>
      </div>
    </div>
    <div class="legal-line">
      <span>{e(t["copy"])}</span>
      <span>{e(t["privacy_note"])}</span>
    </div>
  </div>
</footer>
<a class="wa-float" href="#contact" data-wa aria-label="{e(t["wa"])}">{WA_ICON}</a>
<script src="/assets/kuwait.js"></script>
</body>
</html>
'''


for lang in ('en', 'ar'):
    out = OUT / ('index.html' if lang == 'en' else 'ar/index.html')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(lang), encoding='utf-8')
    print('wrote', out.relative_to(ROOT))
