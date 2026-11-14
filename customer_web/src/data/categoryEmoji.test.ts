import { describe, expect, it } from 'vitest';
import { categoryEmoji, emojiFromName } from './categoryEmoji';

describe('the shape of a category', () => {
  it('is the one Platform Admin picked, whatever the name says', () => {
    expect(categoryEmoji('lock', 'Printers')).toBe('🔒');
    expect(categoryEmoji(' Router ', 'شبكات')).toBe('📡');
  });

  it('is guessed from the name when no icon was picked', () => {
    expect(categoryEmoji('', 'Telecom Equipment')).toBe('📡');
    expect(categoryEmoji('', 'Cybersecurity & Cloud')).toBe('🛡️');
    expect(categoryEmoji('', 'شبكات')).toBe('🌐');
    expect(categoryEmoji('', 'CCTV & Security System')).toBe('🎥');
    expect(categoryEmoji('', 'Computers and Accessories')).toBe('🖥️');
  });

  it('reads any of the names a category has', () => {
    expect(categoryEmoji('', 'الطابعات والمستلزمات Printers')).toBe('🖨️');
    expect(emojiFromName('كهرباء')).toBe('⚡');
    expect(emojiFromName('التدريب والشهادات')).toBe('🎓');
    expect(emojiFromName('خدمات تقنية المعلومات')).toBe('🛠️');
  });

  it('matches an Arabic word anywhere but a Latin one only at the start of a word', () => {
    expect(emojiFromName('الطابعات')).toBe('🖨️');
    expect(emojiFromName('Groups')).toBeNull();
    expect(emojiFromName('UPS and batteries')).toBe('⚡');
  });

  it('falls back to a box when nothing fits', () => {
    expect(categoryEmoji('', 'Misc')).toBe('📦');
    expect(categoryEmoji('unknown-key', '')).toBe('📦');
  });
});
