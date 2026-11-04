/**
 * The marketplace's ready-made category tree: 12 main categories with their
 * sub-categories, in Arabic and English. "Import the ready-made tree" on the
 * Categories page adds it (see categoryImport.ts). `icon` and `color` are the
 * CATEGORY_ICONS / CATEGORY_COLORS keys the customer tiles use; an empty icon
 * means the app picks one from the name.
 */
export interface CategoryTemplate {
  ar: string;
  en: string;
  icon: string;
  color?: string;
  children?: readonly CategoryTemplate[];
}

const sub = (ar: string, en: string, icon = ''): CategoryTemplate => ({ ar, en, icon });

export const DEFAULT_CATEGORY_TREE: readonly CategoryTemplate[] = [
  {
    ar: 'أجهزة وتقنية المعلومات', en: 'IT Hardware & Devices', icon: 'laptop', color: 'blue',
    children: [
      sub('لابتوبات', 'Laptops', 'laptop'),
      sub('حواسيب مكتبية', 'Desktops', 'computer'),
      sub('سيرفرات', 'Servers', 'server'),
      sub('طابعات وماسحات', 'Printers & Scanners', 'printer'),
      sub('ملحقات وتخزين', 'Accessories & Storage', 'accessory'),
    ],
  },
  {
    ar: 'الشبكات والبنية التحتية', en: 'Networks & Infrastructure', icon: 'network', color: 'sky',
    children: [
      sub('راوترات وسويتشات', 'Routers & Switches', 'router'),
      sub('شبكات لاسلكية', 'Wireless', 'wifi'),
      sub('كابلات وتمديدات', 'Cabling', 'cable'),
      sub('جدران حماية', 'Firewalls', 'security'),
    ],
  },
  {
    ar: 'الاتصالات', en: 'Telecom & Communication', icon: 'router', color: 'indigo',
    children: [
      sub('أبراج وراديو', 'Towers & Radio', 'router'),
      sub('ألياف ضوئية', 'Fiber Optics', 'cable'),
      sub('VoIP وسنترالات', 'VoIP & PBX', 'headset'),
      sub('إنترنت فضائي VSAT', 'VSAT & Satellite', 'network'),
    ],
  },
  {
    ar: 'مراكز البيانات والسحابة', en: 'Cloud & Data Centers', icon: 'cloud', color: 'teal',
    children: [
      sub('استضافة سحابية', 'Cloud Hosting', 'cloud'),
      sub('نسخ احتياطي', 'Backup', 'storage'),
      sub('تجهيز مراكز البيانات', 'Data Center Setup', 'server'),
    ],
  },
  {
    ar: 'الأمن السيبراني', en: 'Cybersecurity', icon: 'security', color: 'red',
    children: [
      sub('جدران حماية', 'Firewalls', 'security'),
      sub('مكافحة الفيروسات', 'Antivirus', 'security'),
      sub('اختبار اختراق', 'Penetration Testing', 'tools'),
      sub('استشارات أمنية', 'Security Consulting', 'service'),
    ],
  },
  {
    ar: 'الافتراضية', en: 'Virtualization', icon: 'server', color: 'purple',
    children: [sub('VMware', 'VMware', 'server'), sub('Hyper-V', 'Hyper-V', 'server'), sub('الحاويات', 'Containers', 'server')],
  },
  {
    ar: 'البرمجيات والحلول', en: 'Software & Solutions', icon: 'software', color: 'green',
    children: [
      sub('أنظمة ERP', 'ERP Systems', 'software'),
      sub('تطبيقات الجوال', 'Mobile Apps', 'phone'),
      sub('مواقع وتجارة إلكترونية', 'Web & E-commerce', 'network'),
      sub('برمجيات مخصصة', 'Custom Software', 'software'),
    ],
  },
  {
    ar: 'خدمات تقنية المعلومات', en: 'IT Services', icon: 'service', color: 'amber',
    children: [
      sub('دعم فني وصيانة', 'Support & Maintenance', 'tools'),
      sub('تركيب الشبكات', 'Network Installation', 'network'),
      sub('استشارات تقنية', 'IT Consulting', 'service'),
    ],
  },
  {
    ar: 'المراقبة والأمن', en: 'CCTV & Security', icon: 'cctv', color: 'orange',
    children: [
      sub('كاميرات مراقبة', 'CCTV Cameras', 'cctv'),
      sub('أنظمة إنذار', 'Alarm Systems', 'security'),
      sub('التحكم بالدخول', 'Access Control', 'security'),
    ],
  },
  {
    ar: 'الطاقة والحلول الاحتياطية', en: 'Power & Backup', icon: 'battery', color: 'pink',
    children: [sub('UPS', 'UPS', 'ups'), sub('طاقة شمسية', 'Solar', 'battery'), sub('بطاريات ومولدات', 'Batteries & Generators', 'battery')],
  },
  {
    ar: 'الهواتف والأجهزة الذكية', en: 'Mobile & Smart Devices', icon: 'phone', color: 'sky',
    children: [
      sub('هواتف ذكية', 'Smartphones', 'phone'),
      sub('أجهزة لوحية', 'Tablets', 'tablet'),
      sub('ساعات وملحقات', 'Wearables & Accessories', 'accessory'),
    ],
  },
  {
    ar: 'التدريب والشهادات', en: 'Training & Certification', icon: 'monitor', color: 'indigo',
    children: [
      sub('شهادات Cisco', 'Cisco Certifications', 'network'),
      sub('دورات برمجة', 'Programming Courses', 'software'),
      sub('دورات أمن سيبراني', 'Cybersecurity Courses', 'security'),
    ],
  },
];
