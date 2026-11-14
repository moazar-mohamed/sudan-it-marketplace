/**
 * The shape each category shows: Platform Admin picks an icon key for a category
 * and the customer site draws the matching colourful picture. This is the same
 * table as the dashboard's icon picker (platform_admin_web/src/data/categoryIcons.ts,
 * checked there by a test), so the picker shows what customers see.
 */
export const CATEGORY_EMOJI: Readonly<Record<string, string>> = {
  laptop: '💻',
  computer: '🖥️',
  phone: '📱',
  tablet: '📲',
  router: '📡',
  network: '🌐',
  wifi: '📶',
  camera: '📷',
  cctv: '🎥',
  video: '📹',
  printer: '🖨️',
  server: '🗄️',
  storage: '💾',
  monitor: '📺',
  keyboard: '⌨️',
  mouse: '🖱️',
  headset: '🎧',
  battery: '🔋',
  ups: '⚡',
  cable: '🔗',
  security: '🛡️',
  lock: '🔒',
  software: '🧩',
  cloud: '☁️',
  service: '🛠️',
  gear: '⚙️',
  tools: '🔧',
  game: '🎮',
  accessory: '🔌',
  education: '🎓',
};

/** What a category shows when neither its icon nor its name says anything. */
export const DEFAULT_EMOJI = '📦';

/** Lower case, no diacritics, ة→ه and the alef forms folded, so Arabic spellings match. */
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي');

/**
 * Words in a category's name that hint at a shape, checked in order (the same
 * list as the app's category_grid.dart, plus training and electricity). A
 * Latin word must start a word ("ups" is not in "groups"); an Arabic one may
 * sit anywhere, so "الطابعات" still finds "طابعات".
 */
const NAME_HINTS: readonly (readonly [string, readonly string[]])[] = [
  ['laptop', ['laptop', 'notebook', 'لابتوب', 'لاب توب']],
  ['computer', ['computer', 'desktop', 'كمبيوتر', 'حاسوب', 'حاسب']],
  ['phone', ['phone', 'mobile', 'موبايل', 'هاتف', 'جوال', 'تلفون']],
  ['tablet', ['tablet', 'تابلت']],
  ['router', ['router', 'telecom', 'راوتر', 'روتر', 'اتصالات']],
  ['wifi', ['wifi', 'wi-fi', 'wireless', 'واي فاي', 'وايفاي', 'لاسلكي']],
  ['network', ['network', 'switch', 'شبكه', 'شبكات', 'سويتش']],
  ['cctv', ['camera', 'cctv', 'كاميرا', 'كاميرات', 'مراقبه']],
  ['printer', ['printer', 'طابعه', 'طابعات']],
  ['server', ['server', 'virtual', 'سيرفر', 'خادم', 'خوادم', 'افتراض']],
  ['storage', ['storage', 'hard', 'ssd', 'تخزين', 'هارد', 'قرص']],
  ['monitor', ['monitor', 'screen', 'display', 'شاشه', 'شاشات']],
  ['keyboard', ['keyboard', 'كيبورد', 'لوحه مفاتيح']],
  ['mouse', ['mouse', 'ماوس']],
  ['headset', ['headset', 'headphone', 'سماعه', 'سماعات']],
  ['ups', ['ups', 'power', 'electric', 'طاقه', 'كهرب', 'يو بي اس']],
  ['battery', ['battery', 'charger', 'بطاريه', 'شاحن']],
  ['cable', ['cable', 'كيبل', 'كابل', 'كوابل']],
  ['security', ['security', 'cyber', 'firewall', 'antivirus', 'امن', 'حمايه', 'فايروول']],
  ['software', ['software', 'برنامج', 'برمجيات']],
  ['cloud', ['cloud', 'سحاب']],
  ['game', ['game', 'gaming', 'العاب']],
  ['education', ['training', 'certif', 'course', 'تدريب', 'شهادات', 'دورات']],
  ['accessory', ['accessor', 'ملحقات']],
  ['service', ['service', 'خدمه', 'خدمات', 'installation', 'تركيب', 'صيانه', 'maintenance']],
];

/** The shape that fits [names] (a category's names in every language), or null. */
export function emojiFromName(names: string): string | null {
  const text = ` ${normalize(names)} `;
  for (const [key, words] of NAME_HINTS) {
    for (const word of words) {
      const latin = /^[a-z]/.test(word);
      if (text.includes(latin ? ` ${word}` : word)) return CATEGORY_EMOJI[key];
    }
  }
  return null;
}

/** The icon Platform Admin picked, else one guessed from the name, else a box. */
export const categoryEmoji = (iconName: string, names = ''): string =>
  CATEGORY_EMOJI[iconName.trim().toLowerCase()] ?? emojiFromName(names) ?? DEFAULT_EMOJI;
