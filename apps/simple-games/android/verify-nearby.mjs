import { cp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Compile/test product native code without replacing the app's generated Web assets,
// signing an APK, installing on a device, or importing the separate nearby prototype.
const androidRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(androidRoot);
const stage = join(androidRoot, 'build/nearby-verification');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(SG_|ADMOB_|META_|CAP_PUBLISH$)/.test(key)),
);

function run(command, args, cwd = stage) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await mkdir(join(stage, 'android'));
for (const entry of await readdir(androidRoot)) {
  if (['build', '.gradle', '.idea'].includes(entry)) continue;
  await cp(join(androidRoot, entry), join(stage, 'android', entry), {
    recursive: true,
    filter: (source) => {
      const parts = relative(androidRoot, source).split('/');
      return (
        !parts.some((part) => ['build', '.gradle', '.idea', 'assets'].includes(part)) &&
        !/\.(?:jks|keystore|p12|pfx)$/.test(source) &&
        !['local.properties', 'google-services.json'].includes(parts.at(-1))
      );
    },
  });
}
await cp(join(appRoot, 'package.json'), join(stage, 'package.json'));
await symlink(join(appRoot, 'node_modules'), join(stage, 'node_modules'), 'dir');
await mkdir(join(stage, 'dist'));
await writeFile(
  join(stage, 'dist/index.html'),
  '<!doctype html><title>Native compilation check only</title>',
);
await writeFile(
  join(stage, 'capacitor.config.json'),
  JSON.stringify({
    appId: 'com.pixapps.simplegames',
    appName: 'Simple Games',
    webDir: 'dist',
  }),
);
run(process.execPath, [
  join(appRoot, 'node_modules/@capacitor/cli/bin/capacitor'),
  'sync',
  'android',
]);

// Capacitor normally points at node_modules projects; isolate their build outputs too.
const nativeRoot = join(stage, 'android');
const settings = join(nativeRoot, 'capacitor.settings.gradle');
const source = await readFile(settings, 'utf8');
const projectPattern = /project\('(:[^']+)'\)\.projectDir = new File\('([^']+)'\)/g;
const projects = [...source.matchAll(projectPattern)];
if (
  !projects.length ||
  projects.length !== source.split('\n').filter((line) => line.includes('.projectDir')).length
) {
  throw new Error(
    'Unrecognized Capacitor project paths; refusing to build outside isolated staging',
  );
}
for (const match of projects) {
  const [, project, path] = match;
  const dependencyRoot = resolve(nativeRoot, path);
  await cp(dependencyRoot, join(nativeRoot, 'dependency-projects', project.slice(1)), {
    recursive: true,
    filter: (file) =>
      !relative(dependencyRoot, file)
        .split('/')
        .some((part) => ['build', '.gradle', '.idea'].includes(part)),
  });
}
await writeFile(
  settings,
  source.replace(
    projectPattern,
    (_, project) =>
      `project('${project}').projectDir = new File('./dependency-projects/${project.slice(1)}')`,
  ),
);
run(
  './gradlew',
  [
    ...(process.argv.includes('--offline') ? ['--offline'] : []),
    '--no-daemon',
    '--max-workers=2',
    '-Pkotlin.compiler.execution.strategy=in-process',
    ':app:compileDebugJavaWithJavac',
    ':app:testDebugUnitTest',
  ],
  nativeRoot,
);
console.log(
  `Product native compilation/tests passed. Reports: ${join(nativeRoot, 'app/build/reports/tests/testDebugUnitTest')}`,
);
