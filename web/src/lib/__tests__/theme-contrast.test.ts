/**
 * Guards text contrast on accent-coloured surfaces in both themes.
 * Text on bg-[var(--color-accent)] must use --color-on-accent, never a
 * hard-coded white: the dark-theme accent is light enough that white fails.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(SRC, 'app', 'globals.css'), 'utf8');

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Effective value of a token: from the last block that starts at `selector`. */
function token(selector: string, name: string): string {
  const start = css.lastIndexOf(selector); // later blocks override earlier ones
  expect(start).toBeGreaterThanOrEqual(0);
  const block = css.slice(start, css.indexOf('}', start));
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`--${name} not defined in ${selector}`);
  return match[1];
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

describe('accent contrast', () => {
  it.each([
    ['light', ':root {'],
    ['dark', '[data-theme="dark"], .dark {'],
  ])('on-accent text meets WCAG AA (4.5:1) in %s theme', (_theme, selector) => {
    const accent = token(selector, 'color-accent');
    const onAccent = token(selector, 'color-on-accent');
    expect(contrast(accent, onAccent)).toBeGreaterThanOrEqual(4.5);
  });

  it('components never pair the accent background with hard-coded white text', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => /bg-\[var\(--color-accent\)\]/.test(line) && /\btext-white\b/.test(line))
        .map(({ at }) => at)
    );
    expect(offenders).toEqual([]);
  });
});
