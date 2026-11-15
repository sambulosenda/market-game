// Pre-submission checks for the store release. Run with `npm run check:release`.
//
// Problems are things a store would reject or that would ship wrong. "To do"
// items are values only the owner of the store accounts can fill in. The
// script exits with an error while either list is not empty, so a green run
// means the repo side of a submission is ready.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const file = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(file(path), 'utf8');
const json = (path) => JSON.parse(read(path));

const problems = [];
const todo = [];

const app = json('app.json').expo;
const pkg = json('package.json');
const eas = json('eas.json');
const store = json('store.config.json').apple;
const site = read('docs/_config.yml');

// Versions and identifiers
if (app.version !== pkg.version) problems.push(`app.json version ${app.version} differs from package.json ${pkg.version}`);
if (store.version !== app.version) problems.push(`store.config.json version ${store.version} differs from app.json ${app.version}`);
if (app.ios?.bundleIdentifier !== app.android?.package) problems.push('The iOS bundle identifier and the Android package differ');
if (eas.cli?.appVersionSource !== 'remote') problems.push('eas.json should keep build numbers on EAS (appVersionSource: remote)');
if (!eas.build?.production?.autoIncrement) problems.push('The production build profile should auto-increment the build number');
if (app.ios?.config?.usesNonExemptEncryption !== false) problems.push('app.json should declare ios.config.usesNonExemptEncryption: false');
if (!app.extra?.eas?.projectId) todo.push('Run `npx eas-cli@latest init` to create the EAS project (adds extra.eas.projectId to app.json)');
if (!eas.submit?.production?.ios?.ascAppId) {
  todo.push('Add the App Store Connect app ID as submit.production.ios.ascAppId in eas.json, once the app record exists');
}

// App Store text limits
const limits = { title: 30, subtitle: 30, promoText: 170, description: 4000, releaseNotes: 4000 };
if (Object.keys(store.info ?? {}).length === 0) problems.push('store.config.json has no listing text (apple.info is empty)');
for (const [locale, info] of Object.entries(store.info ?? {})) {
  for (const [field, max] of Object.entries(limits)) {
    const length = [...(info[field] ?? '')].length;
    if (length === 0) problems.push(`${locale}: ${field} is missing`);
    if (length > max) problems.push(`${locale}: ${field} is ${length} characters, the limit is ${max}`);
  }
  const keywords = (info.keywords ?? []).join(',');
  if (keywords.length > 100) problems.push(`${locale}: keywords are ${keywords.length} characters joined, the limit is 100`);
  for (const field of ['supportUrl', 'privacyPolicyUrl']) {
    if (!/^https:\/\//.test(info[field] ?? '')) problems.push(`${locale}: ${field} must be an https URL`);
  }
}
if (/CHANGE-ME/.test(store.copyright ?? '')) todo.push('Set the copyright owner in store.config.json');

// Public pages
if (/CHANGE-ME/.test(site)) todo.push('Set developer_name and support_email in docs/_config.yml');

// Icons. The App Store rejects an icon with transparency.
const icon = await sharp(file(app.icon)).metadata();
if (icon.width !== 1024 || icon.height !== 1024) problems.push(`The app icon is ${icon.width}x${icon.height}, it must be 1024x1024`);
if (icon.hasAlpha) problems.push('The app icon has an alpha channel, which the App Store rejects');
const foreground = await sharp(file(app.android.adaptiveIcon.foregroundImage)).metadata();
if (foreground.width !== 1024 || foreground.height !== 1024) problems.push('The Android adaptive icon foreground must be 1024x1024');

const list = (title, items) => {
  if (items.length === 0) return;
  console.log(`\n${title}`);
  for (const item of items) console.log(`  - ${item}`);
};
list('Problems', problems);
list('To do before submitting', todo);
if (problems.length + todo.length === 0) console.log('Ready to submit.');
process.exit(problems.length + todo.length === 0 ? 0 : 1);
