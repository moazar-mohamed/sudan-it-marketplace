import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, checkImageFile, extensionFor, isValidImageUrl } from './imageRules';

describe('checkImageFile', () => {
  it('accepts the supported image types up to the size limit', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: 1024 })).toBeNull();
    expect(checkImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull();
    expect(checkImageFile({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects files that are not a supported image', () => {
    expect(checkImageFile({ type: 'application/pdf', size: 10 })).toBe('unsupported');
    expect(checkImageFile({ type: 'image/svg+xml', size: 10 })).toBe('unsupported');
    expect(checkImageFile({ type: '', size: 10 })).toBe('unsupported');
  });

  it('rejects images over the size limit', () => {
    expect(checkImageFile({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toBe('tooLarge');
  });
});

describe('isValidImageUrl', () => {
  it('accepts http and https links', () => {
    expect(isValidImageUrl('https://example.com/a.jpg')).toBe(true);
    expect(isValidImageUrl('  http://example.com/a.png  ')).toBe(true);
  });

  it('rejects empty, malformed and non-http values', () => {
    expect(isValidImageUrl('')).toBe(false);
    expect(isValidImageUrl('   ')).toBe(false);
    expect(isValidImageUrl('example.com/a.jpg')).toBe(false);
    expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    expect(isValidImageUrl('ftp://example.com/a.jpg')).toBe(false);
    expect(isValidImageUrl('data:image/png;base64,AAAA')).toBe(false);
  });
});

describe('extensionFor', () => {
  it('maps content types to file extensions', () => {
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/gif')).toBe('gif');
    expect(extensionFor('image/jpeg')).toBe('jpg');
  });
});
