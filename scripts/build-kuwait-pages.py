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
    'car': '<rect x="1" y="10" width="22" height="7" rx="2"/><circle cx="6.5" cy="17" r="2.5"/><circle cx="17.5" cy="17" r="2.5"/><path d="M5 10l2-5h10l2 5"/>',
    'family': '<circle cx="12" cy="5" r="3"/><path d="M12 8c-4 0-6 2-6 5h12c0-3-2-5-6-5z"/><circle cx="5" cy="14" r="2"/><path d="M5 16c-2.5 0-4 1.5-4 3.5h8c0-2-1.5-3.5-4-3.5z"/><circle cx="19" cy="14" r="2"/><path d="M19 16c-2.5 0-4 1.5-4 3.5h8c0-2-1.5-3.5-4-3.5z"/>',
    'shared': '<path d="M3 9l9-6 9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22v-6h6v6"/><circle cx="12" cy="11" r="2"/>',
    'friends': '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 21v-2a5 5 0 0 1 7-4.5"/><path d="M14 14.5a5 5 0 0 1 7 4.5v2"/>',
    'nail': '<path d="M10 3h4v5h-4z"/><path d="M8 8h8l1 4v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7z"/><path d="M7 14h10"/>',
    'cafe': '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/>',
    'fleet': '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M18 7h2l3 4v6h-3"/><circle cx="7" cy="17" r="2"/><circle cx="20" cy="17" r="2"/>',
}
WA_ICON = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 '
           '10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8'
           '-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5'
           'a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1'
           '.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>')

TEXT = {
    'en': {
        'dir': 'ltr', 'path': '/kuwait/',
        'title': 'Uyoon Tech Solutions · IT Services for Kuwait and the GCC',
        'desc': 'IT solutions for businesses and families in Kuwait and the GCC: vehicle safety, expense management, custom software development, and Arabic-first digital services.',
        'brand_sub': 'Kuwait · GCC',
        'nav': [('#solutions', 'Solutions'), ('#why', 'Why us'), ('#contact', 'Contact')],
        'region_label': 'Choose region', 'india': 'India', 'kuwait': 'Kuwait',
        'lang_label': 'Language',
        'eyebrow': 'Kuwait · GCC',
        'h1': 'IT solutions for Kuwait, <em>built Arabic-first.</em>',
        'lead': 'Uyoon Tech Solutions delivers software and IT services designed for businesses and families across Kuwait and the GCC. Every product works fully in Arabic and English, respects your privacy, and is backed by a team that understands the region.',
        'cta_products': 'Explore our solutions', 'cta_wa': 'Chat on WhatsApp',
        'trust': ['Arabic and English built in', 'Privacy by design', 'GCC-focused support'],
        'products_eyebrow': 'Our solutions', 'products_h2': 'Solutions for Kuwait and the GCC',
        'products_p': 'Ready-to-use products from Uyoon Tech Solutions, designed for the GCC market. Book a free demo or talk to us about a custom solution for your business.',
        'features': 'Key features', 'for': "Who it's for",
        'tags': {'shop': 'Shop', 'restaurant': 'Restaurant', 'salon': 'Salon', 'school': 'School',
                 'car': 'Vehicle owner', 'family': 'Family', 'shared': 'Shared room', 'friends': 'Friends & groups', 'fleet': 'Fleet & delivery',
                 'nail': 'Nail studio', 'cafe': 'Cafe'},
        'demo': 'Get a demo', 'more': 'Learn more',
        'why_eyebrow': 'Why Uyoon Tech Solutions', 'why_h2': 'Your IT partner for the GCC',
        'why': [
            ('Arabic-first engineering', 'Right-to-left interfaces, Arabic fonts and locale-aware numbers are part of the architecture, not an afterthought.'),
            ('Privacy by design', 'We build software that keeps personal data private. Phone numbers and details are never exposed or sold.'),
            ('Transparent and auditable', 'Important actions are recorded, so records cannot be rewritten without a trace.'),
            ('Scalable for the region', 'From a family car to a fleet of delivery vehicles, from a shared flat to a chain of shops — our solutions grow with you.'),
        ],
        'c_eyebrow': 'Contact', 'c_h2': 'Get in touch with our Kuwait team',
        'c_p': 'Whether you want a demo of an existing product or need a custom IT solution, leave your details and our team will reach out on WhatsApp.',
        'c_points': ['Free consultation, no commitment', 'Arabic or English, as you prefer', 'Reply on working days'],
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
        'foot_tag': 'IT solutions and software services for Kuwait and the GCC.',
        'foot_products': 'Solutions', 'foot_help': 'Help',
        'foot_contact': 'Contact', 'foot_demo': 'Talk to us',
        'reg': [('Company Name', None), ('Address', None), ('Email', None), ('Phone', '+965 4102 4821')],
        'tbu': '[To Be Updated]',
        'copy': '© 2026 Uyoon Tech Solutions. All rights reserved.',
        'privacy_note': "Each product's privacy policy and terms are on its own page.",
    },
    'ar': {
        'dir': 'rtl', 'path': '/kuwait/ar/',
        'title': 'عيون تك سوليوشنز · خدمات تقنية للكويت والخليج',
        'desc': 'حلول تقنية للأعمال والعائلات في الكويت ودول الخليج: سلامة المركبات، إدارة المصروفات، تطوير البرمجيات، وخدمات رقمية بالعربية أولاً.',
        'brand_sub': 'الكويت · الخليج',
        'nav': [('#solutions', 'الحلول'), ('#why', 'لماذا نحن'), ('#contact', 'تواصل معنا')],
        'region_label': 'اختر المنطقة', 'india': 'الهند', 'kuwait': 'الكويت',
        'lang_label': 'اللغة',
        'eyebrow': 'الكويت · الخليج',
        'h1': 'حلول تقنية للكويت، <em>مصمّمة بالعربية أولاً.</em>',
        'lead': 'عيون تك سوليوشنز تقدّم برمجيات وخدمات تقنية مصمّمة للأعمال والعائلات في الكويت ودول الخليج. كل منتج يعمل بالكامل بالعربية والإنجليزية، ويحافظ على خصوصيتك، ويدعمه فريق يفهم المنطقة.',
        'cta_products': 'استكشف حلولنا', 'cta_wa': 'تواصل عبر واتساب',
        'trust': ['عربي وإنجليزي مدمج', 'خصوصية حسب التصميم', 'دعم مخصّص للخليج'],
        'products_eyebrow': 'حلولنا', 'products_h2': 'حلول للكويت ودول الخليج',
        'products_p': 'منتجات جاهزة من عيون تك سوليوشنز، مصمّمة لسوق الخليج. احجز عرضاً تجريبياً مجانياً أو تحدّث معنا عن حل مخصّص لعملك.',
        'features': 'أهم المزايا', 'for': 'لمن هذا المنتج',
        'tags': {'shop': 'محل', 'restaurant': 'مطعم', 'salon': 'صالون', 'school': 'مدرسة',
                 'car': 'صاحب مركبة', 'family': 'عائلة', 'shared': 'سكن مشترك', 'friends': 'أصدقاء ومجموعات', 'fleet': 'أساطيل وتوصيل',
                 'nail': 'استوديو أظافر', 'cafe': 'مقهى'},
        'demo': 'اطلب عرضاً تجريبياً', 'more': 'اعرف المزيد',
        'why_eyebrow': 'لماذا عيون تك سوليوشنز', 'why_h2': 'شريكك التقني في الخليج',
        'why': [
            ('هندسة عربية أولاً', 'واجهات من اليمين إلى اليسار وخطوط وأرقام حسب المنطقة مدمجة في البنية، لا كإضافة لاحقة.'),
            ('خصوصية حسب التصميم', 'نبني برمجيات تحافظ على خصوصية بياناتك. الأرقام والبيانات الشخصية لا تُكشف ولا تُباع.'),
            ('شفافية وقابلية تدقيق', 'الإجراءات المهمة مسجّلة، فلا يمكن تعديل السجلات دون أثر.'),
            ('حلول تنمو معك', 'من سيارة عائلية إلى أسطول توصيل، ومن شقة مشتركة إلى سلسلة محلات — حلولنا تتوسّع معك.'),
        ],
        'c_eyebrow': 'تواصل معنا', 'c_h2': 'تواصل مع فريقنا في الكويت',
        'c_p': 'سواء كنت تريد عرضاً تجريبياً لمنتج موجود أو تحتاج حلاً تقنياً مخصّصاً، اترك بياناتك وسيتواصل فريقنا عبر واتساب.',
        'c_points': ['استشارة مجانية دون التزام', 'بالعربية أو الإنجليزية كما تفضّل', 'نرد في أيام العمل'],
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
        'foot_tag': 'حلول تقنية وخدمات برمجية للكويت ودول الخليج.',
        'foot_products': 'الحلول', 'foot_help': 'المساعدة',
        'foot_contact': 'تواصل معنا', 'foot_demo': 'تحدّث معنا',
        'reg': [('اسم الشركة', None), ('العنوان', None), ('البريد الإلكتروني', None), ('الهاتف', '+965 4102 4821')],
        'tbu': '[سيتم التحديث]',
        'copy': '© 2026 عيون تك سوليوشنز. جميع الحقوق محفوظة.',
        'privacy_note': 'سياسة الخصوصية والشروط لكل منتج في صفحته الخاصة.',
    },
}

# Only products that already exist on tech.utplgroup.com. Add new ones here when they launch.
PRODUCTS = [
    {
        'id': 'mess-manager', 'icon': '/assets/mess-manager-icon.png', 'link': '/mess-manager/',
        'for': ['shared', 'friends', 'shop', 'restaurant', 'salon', 'family'],
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
            'for_note': 'For anyone sharing daily expenses: bachelors, friends in a flat, families splitting household costs, staff housing, hostel rooms, labour camps, and shop, restaurant or salon teams.',
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
            'for_note': 'لكل من يتشارك المصاريف اليومية: العزّاب، الأصدقاء في شقة، العائلات التي تقسم تكاليف المنزل، سكن الموظفين، غرف السكن الجماعي، والمعسكرات العمالية، وفرق المحلات والمطاعم والصالونات.',
        },
    },
    {
        'id': 'uyoon-al-wasel', 'icon': '/assets/uyoon-al-wasel-icon.png', 'link': 'https://wasel.utplgroup.com',
        'for': ['car', 'family', 'fleet', 'shop', 'restaurant', 'school'],
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
            'for_note': 'For every vehicle owner: family cars, private drivers, taxis, delivery vehicles, company fleets, school buses, and shop or restaurant cars.',
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
            'for_note': 'لكل صاحب مركبة: سيارات العائلة، السائقين الخاصين، سيارات الأجرة، مركبات التوصيل، أساطيل الشركات، حافلات المدارس، وسيارات المحلات والمطاعم.',
        },
    },
    {
        # No public landing page yet (the bare salon.utplgroup.com shows "Not found"), so no "Learn more" link.
        'id': 'salon-booking', 'icon': '/assets/salon-booking-icon.svg', 'link': None,
        'for': ['salon', 'nail', 'shop', 'cafe'],
        'en': {
            'name': 'Salon Booking Platform', 'alt': 'منصة حجوزات الصالون', 'pill': 'Web app · Online appointments',
            'desc': 'Online appointments for salons, barbershops, nail studios, cosmetics shops and cafes. Each shop gets its own booking link with its own name, logo and colours, and customers book in under a minute with no app to download.',
            'features': [
                ('Book in 3 steps', 'service, staff and a free time slot'),
                ('No double booking', 'checked by the system, with a gap between appointments'),
                ('Your own brand', 'your link, logo, colours, banner and offer poster'),
                ('Owner admin panel', 'services, prices, staff, working hours and off days'),
                ('Cash, KNET or online', 'prices in KWD or your local currency'),
            ],
            'for_note': 'For gents salons and barbershops, ladies salons, nail studios, cosmetics shops and cafes in Kuwait, the GCC and India. In Arabic, English and Urdu.',
        },
        'ar': {
            'name': 'منصة حجوزات الصالون', 'alt': 'Salon Booking Platform', 'pill': 'تطبيق ويب · حجز المواعيد',
            'desc': 'حجز المواعيد أونلاين للصالونات ومحلات الحلاقة واستوديوهات الأظافر ومحلات مستحضرات التجميل والمقاهي. لكل محل رابط حجز خاص باسمه وشعاره وألوانه، ويحجز العميل في أقل من دقيقة دون تنزيل أي تطبيق.',
            'features': [
                ('حجز في 3 خطوات', 'الخدمة والموظف والوقت المتاح'),
                ('لا حجز مزدوج', 'يتحقق النظام منه مع فاصل بين المواعيد'),
                ('علامتك الخاصة', 'رابطك وشعارك وألوانك والبانر وملصق العروض'),
                ('لوحة تحكم للمالك', 'الخدمات والأسعار والموظفون وساعات العمل وأيام العطلة'),
                ('نقداً أو كي نت أو أونلاين', 'الأسعار بالدينار الكويتي أو بعملتك المحلية'),
            ],
            'for_note': 'لصالونات الرجال ومحلات الحلاقة، وصالونات السيدات، واستوديوهات الأظافر، ومحلات مستحضرات التجميل، والمقاهي في الكويت ودول الخليج والهند. بالعربية والإنجليزية والأردو.',
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
    more = ''
    if p['link']:
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
    def reg_dd(v):
        if v is None:
            return f'<dd class="tbu">{e(t["tbu"])}</dd>'
        val = e(v)
        if v.startswith('+'):
            val = f'<span class="ltr">{val}</span>'
        return f'<dd>{val}</dd>'
    reg = ''.join(f'<dt>{e(k)}</dt>{reg_dd(v)}' for k, v in t['reg'])
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
  <section class="section" id="solutions">
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
