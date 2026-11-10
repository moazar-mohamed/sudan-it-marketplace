import { describe, expect, it } from 'vitest';
import { loginPath, safeNext, withNext } from './nextPath';

describe('safeNext', () => {
  it('keeps a page of this site with its query', () => {
    expect(safeNext('/checkout/p1?qty=3')).toBe('/checkout/p1?qty=3');
    expect(safeNext('/chats?product=p1')).toBe('/chats?product=p1');
  });

  it('never leaves the site', () => {
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example/x')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
  });

  it('never goes back to a sign-in page', () => {
    expect(safeNext('/login')).toBe('/');
    expect(safeNext('/register?next=/orders')).toBe('/');
    expect(safeNext('/forgot-password')).toBe('/');
  });

  it('is the home page when there is nothing', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext('')).toBe('/');
  });
});

describe('loginPath / withNext', () => {
  it('carries the page to come back to', () => {
    expect(loginPath('/checkout/p1?qty=3')).toBe('/login?next=%2Fcheckout%2Fp1%3Fqty%3D3');
    expect(withNext('/register', '/orders')).toBe('/register?next=%2Forders');
  });

  it('drops a next that is only the home page or unsafe', () => {
    expect(loginPath('/')).toBe('/login');
    expect(loginPath('https://evil.example')).toBe('/login');
    expect(withNext('/register', null)).toBe('/register');
  });
});
