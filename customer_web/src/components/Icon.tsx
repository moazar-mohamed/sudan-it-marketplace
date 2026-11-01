export const PATHS = {
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z m9 2-3.5-3.5',
  pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1-4 4-6 8-6s7 2 8 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  auto: 'M3 4h18v12H3z M8 20h8 M12 16v4',
  arrow: 'M19 12H5 M11 6l-6 6 6 6',
  box: 'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  chat: 'M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3z',
  wrench:
    'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  building: 'M4 21V5l8-2v18 M12 9h8v12 M4 21h16 M8 8h1 M8 12h1 M8 16h1',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  home: 'M3 11 12 3l9 8 M5 10v10h14V10',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z M10 20h4',
  lock: 'M6 11h12v10H6z M8.5 11V7a3.5 3.5 0 0 1 7 0v4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1',
  flag: 'M5 21V4 M5 4h12l-2 4 2 4H5',
} as const;

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg className="ico" style={{ width: size, height: size }} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
