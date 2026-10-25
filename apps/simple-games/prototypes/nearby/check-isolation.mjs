import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, '../..');
function walk(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, extensions);
    return extensions.test(entry.name) ? [path] : [];
  });
}
const forbidden =
  /NearbyPoc|prototypes\/nearby|9b5d100[012]-7a4c-4e13-a280-75d53c01a268|_sgnearby\._tcp/i;
if (!forbidden.test('NearbyPoc') || !forbidden.test('_sgnearby._tcp'))
  throw new Error('Isolation matcher is broken');
const files = [
  ...walk(join(app, 'src'), /\.[cm]?[jt]sx?$/),
  ...walk(join(app, 'dist'), /\.(js|html|css|json)$/),
  ...walk(join(app, 'dist-web'), /\.(js|html|css|json)$/),
  ...walk(join(app, 'android/app/src/main'), /\.(java|kt|xml)$/),
  ...walk(join(app, 'ios/App/App'), /\.(swift|plist)$/),
];
for (const path of files)
  if (forbidden.test(readFileSync(path, 'utf8')))
    throw new Error(`PoC leaked into production: ${relative(app, path)}`);
// Product-owned Nearby Play uses distinct service identifiers. Permissions are
// now intentional; importing the development application remains prohibited.
const web = walk(join(app, 'dist-web'), /\.(js|html|css|json)$/);
for (const path of web)
  if (/NearbyPlay|_sgnearplay\._tcp|9b5d200[012]-7a4c/i.test(readFileSync(path, 'utf8')))
    throw new Error(`Native Nearby Play leaked into Web: ${relative(app, path)}`);
console.log(
  `Nearby isolation: ${files.length} files checked; no development app in product and no native Nearby Play in Web.`,
);
