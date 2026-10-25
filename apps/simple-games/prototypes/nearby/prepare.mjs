import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Creates only the separate, ignored laboratory project. No signing or installation.
const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const platform = process.argv[2];
if (!['android', 'ios'].includes(platform)) throw new Error('Usage: node prepare.mjs android|ios');
const config = JSON.parse(readFileSync(join(root, 'capacitor.config.json'), 'utf8'));
if (
  config.appId !== 'com.pixapps.nearbypoc' ||
  config.webDir !== 'dist' ||
  config.includePlugins.length !== 0
)
  throw new Error('Unexpected PoC identity or plugins');
const run = (command, args, cwd = root) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
};
const cli = join(dirname(require.resolve('@capacitor/cli/package.json')), 'bin/capacitor');
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
run(process.execPath, [vite, 'build', '--config', join(root, 'vite.config.ts')]);
if (!existsSync(join(root, platform))) run(process.execPath, [cli, 'add', platform]);
run(process.execPath, [cli, 'sync', platform]);
if (platform === 'ios') {
  run(process.execPath, [join(root, 'native/ios/prepare.mjs')]);
} else {
  const app = join(root, 'android/app');
  if (
    !readFileSync(join(app, 'build.gradle'), 'utf8').includes(
      'applicationId "com.pixapps.nearbypoc"',
    )
  )
    throw new Error('Refusing to modify a different Android app');
  cpSync(join(root, 'native/android/com'), join(app, 'src/main/java/com'), { recursive: true });
  writeFileSync(
    join(app, 'src/main/java/com/pixapps/nearbypoc/MainActivity.java'),
    `package com.pixapps.nearbypoc;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(NearbyPocPlugin.class);
        super.onCreate(state);
    }
}
`,
  );
  const manifestPath = join(app, 'src/main/AndroidManifest.xml');
  let manifest = readFileSync(manifestPath, 'utf8');
  const overlay = readFileSync(join(root, 'native/android/permissions.xml'), 'utf8');
  if (!manifest.includes('</manifest>') || !manifest.includes('android:name=".MainActivity"'))
    throw new Error('Unexpected Android manifest');
  const additions = [...overlay.matchAll(/<uses-(?:permission|feature)\b[^>]*\/>/gs)]
    .map(([element]) => element)
    .filter((element) => {
      const name = element.match(/android:name="([^"]+)"/)?.[1];
      return name && !manifest.includes(`android:name="${name}"`);
    });
  manifest = manifest
    .replace('</manifest>', `${additions.join('\n    ')}\n</manifest>`)
    .replace('android:allowBackup="true"', 'android:allowBackup="false"');
  writeFileSync(manifestPath, manifest);
}
console.log(
  `Prepared isolated ${platform} PoC at ${join(root, platform)}. Build it explicitly; this script does not install it.`,
);
