import { describe, expect, it } from 'vitest';

import { colors } from '../theme';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast', () => {
  // Every pair of text colour and background the interface uses.
  const pairs: [string, keyof typeof colors, keyof typeof colors][] = [
    ['text on a sheet', 'ink', 'panel'],
    ['text on a card', 'ink', 'card'],
    ['text in a well', 'ink', 'well'],
    ['soft text on a sheet', 'inkSoft', 'panel'],
    ['soft text on a card', 'inkSoft', 'card'],
    ['soft text in a well', 'inkSoft', 'well'],
    ['soft text on the page', 'inkSoft', 'page'],
    ['primary button', 'inkOnDark', 'primary'],
    ['secondary button', 'ink', 'secondary'],
    ['enough, on a card', 'good', 'card'],
    ['enough, on a sheet', 'good', 'panel'],
    ['not enough, on a card', 'bad', 'card'],
    ['not enough, on a sheet', 'bad', 'panel'],
    ['toast', 'inkOnDark', 'toast'],
  ];

  it.each(pairs)('%s meets WCAG AA (4.5 to 1)', (_name, text, background) => {
    expect(contrast(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5);
  });
});
