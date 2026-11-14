/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import goods from '../../content/data/goods.json';
import shops from '../../content/data/shops.json';

// The manifest uses require() on images, which only the app bundler understands,
// so these tests check the files and the manifest text instead of importing it.
const root = path.resolve(__dirname, '../../..');
const art = (file: string) => path.join(root, 'assets', 'art', file);
const manifest = readFileSync(path.join(root, 'src', 'art', 'manifest.ts'), 'utf8');

describe('art', () => {
  it('has an icon for every good in the content', () => {
    for (const good of goods.goods) {
      expect(existsSync(art(`goods/good_${good.id}@2x.png`)), `good_${good.id}`).toBe(true);
      expect(manifest).toContain(`good_${good.id}:`);
    }
  });

  it('has a level 1 building and a sign for every shop in the content', () => {
    for (const shop of shops.shops) {
      expect(existsSync(art(`shops/shop_${shop.id}_l1@2x.png`)), `shop_${shop.id}_l1`).toBe(true);
      expect(existsSync(art(`signs/sign_${shop.id}@2x.png`)), `sign_${shop.id}`).toBe(true);
    }
  });

  it('ships every manifest image at @2x and @3x', () => {
    const files = [...manifest.matchAll(/require\('\.\.\/\.\.\/assets\/art\/([^']+)\.png'\)/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      expect(existsSync(art(`${file}@2x.png`)), `${file}@2x`).toBe(true);
      expect(existsSync(art(`${file}@3x.png`)), `${file}@3x`).toBe(true);
    }
  });
});
