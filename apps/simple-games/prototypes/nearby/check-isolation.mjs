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
const androidManifest = readFileSync(join(app, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const iosPlist = readFileSync(join(app, 'ios/App/App/Info.plist'), 'utf8');
if (
  /android.permission.BLUETOOTH|android.hardware.bluetooth_le/.test(androidManifest) ||
  /NSBluetoothAlwaysUsageDescription|NSLocalNetworkUsageDescription|NSBonjourServices/.test(
    iosPlist,
  )
)
  throw new Error('Unreleased Nearby permissions in production');
console.log(
  `Nearby PoC isolation: ${files.length} production source/artifact files checked; no PoC entry, plugin or permissions.`,
);
