import type { Category } from './types';

/**
 * Icons a category can show in the customer app. `key` is what is stored in the
 * category's `iconName`; the app (category_grid.dart) draws the matching icon.
 * An empty `iconName` means "automatic": the app picks one from the name.
 */
export const CATEGORY_ICONS = [
  { key: 'laptop', emoji: '💻', en: 'Laptop', ar: 'لابتوب' },
  { key: 'computer', emoji: '🖥️', en: 'Computer', ar: 'كمبيوتر' },
  { key: 'phone', emoji: '📱', en: 'Phone', ar: 'موبايل' },
  { key: 'tablet', emoji: '📲', en: 'Tablet', ar: 'تابلت' },
  { key: 'router', emoji: '📡', en: 'Router', ar: 'راوتر' },
  { key: 'network', emoji: '🌐', en: 'Network', ar: 'شبكات' },
  { key: 'wifi', emoji: '📶', en: 'Wi-Fi', ar: 'واي فاي' },
  { key: 'camera', emoji: '📷', en: 'Camera', ar: 'كاميرا' },
  { key: 'cctv', emoji: '🎥', en: 'CCTV', ar: 'كاميرات مراقبة' },
  { key: 'printer', emoji: '🖨️', en: 'Printer', ar: 'طابعة' },
  { key: 'server', emoji: '🗄️', en: 'Server', ar: 'سيرفر' },
  { key: 'storage', emoji: '💾', en: 'Storage', ar: 'تخزين' },
  { key: 'monitor', emoji: '🖵', en: 'Monitor', ar: 'شاشة' },
  { key: 'keyboard', emoji: '⌨️', en: 'Keyboard', ar: 'كيبورد' },
  { key: 'mouse', emoji: '🖱️', en: 'Mouse', ar: 'ماوس' },
  { key: 'headset', emoji: '🎧', en: 'Headset', ar: 'سماعة' },
  { key: 'battery', emoji: '🔋', en: 'Battery', ar: 'بطارية' },
  { key: 'ups', emoji: '🔌', en: 'UPS / power', ar: 'طاقة' },
  { key: 'cable', emoji: '🔗', en: 'Cable', ar: 'كيبل' },
  { key: 'security', emoji: '🛡️', en: 'Security', ar: 'حماية' },
  { key: 'software', emoji: '🧩', en: 'Software', ar: 'برامج' },
  { key: 'cloud', emoji: '☁️', en: 'Cloud', ar: 'سحابة' },
  { key: 'service', emoji: '🛠️', en: 'Service', ar: 'خدمة' },
  { key: 'tools', emoji: '🔧', en: 'Tools', ar: 'صيانة' },
  { key: 'game', emoji: '🎮', en: 'Games', ar: 'ألعاب' },
  { key: 'accessory', emoji: '🔌', en: 'Accessory', ar: 'ملحقات' },
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICONS)[number]['key'];

/**
 * Colours a category's tile can take in the customer app. `key` is what is
 * stored in the category's `color`; the hex values are the app's own palette
 * (category_grid_style.dart), so the dashboard shows the colour customers see.
 * An empty `color` means "automatic": the app picks one from the icon.
 */
export const CATEGORY_COLORS = [
  { key: 'blue', hex: '#1E6FD9', en: 'Blue', ar: 'أزرق' },
  { key: 'green', hex: '#16A34A', en: 'Green', ar: 'أخضر' },
  { key: 'purple', hex: '#9333EA', en: 'Purple', ar: 'بنفسجي' },
  { key: 'red', hex: '#E11D48', en: 'Red', ar: 'أحمر' },
  { key: 'indigo', hex: '#4F46E5', en: 'Indigo', ar: 'نيلي' },
  { key: 'amber', hex: '#F59E0B', en: 'Amber', ar: 'كهرماني' },
  { key: 'teal', hex: '#0D9488', en: 'Teal', ar: 'تركوازي' },
  { key: 'sky', hex: '#0284C7', en: 'Sky', ar: 'سماوي' },
  { key: 'orange', hex: '#F97316', en: 'Orange', ar: 'برتقالي' },
  { key: 'pink', hex: '#DB2777', en: 'Pink', ar: 'وردي' },
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLORS)[number]['key'];

export const findCategoryColor = (key: string) =>
  CATEGORY_COLORS.find((color) => color.key === key.trim().toLowerCase());

export const findCategoryIcon = (key: string) =>
  CATEGORY_ICONS.find((icon) => icon.key === key.trim().toLowerCase());

/** The name to show in [locale], falling back to the single legacy name. */
export function categoryDisplayName(category: Category, locale: 'ar' | 'en'): string {
  const localized = (locale === 'ar' ? category.nameAr : category.nameEn).trim();
  return localized || category.name;
}

/** Platform Admin's order first, then the rest by name (as in the app). */
export function sortCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => {
    if (a.sortOrder !== null && b.sortOrder !== null && a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.sortOrder !== null && b.sortOrder === null) return -1;
    if (a.sortOrder === null && b.sortOrder !== null) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/** [ids] with the item at [index] moved one place [direction]; unchanged at the ends. */
export function moveId(ids: readonly string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) {
    return [...ids];
  }
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** The position a newly added category takes: after every existing one. */
export const nextSortOrder = (categories: readonly Category[]): number =>
  categories.reduce((max, c) => Math.max(max, (c.sortOrder ?? -1) + 1, 0), categories.length);
