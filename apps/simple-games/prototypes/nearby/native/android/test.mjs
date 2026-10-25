import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const androidRoot = dirname(fileURLToPath(import.meta.url));
const output = resolve(androidRoot, '../../build/java-tests');
const sourceRoot = join(androidRoot, 'com/pixapps/nearbypoc');
const javaBin = (name) => (process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', name) : name);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(
      `Cannot run ${command}: ${result.error.message}. Install Java 21 or set JAVA_HOME.`,
    );
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await mkdir(output, { recursive: true });
run(javaBin('javac'), [
  '-encoding',
  'UTF-8',
  '-d',
  output,
  join(sourceRoot, 'FrameCodec.java'),
  join(sourceRoot, 'ForegroundStartGate.java'),
  join(sourceRoot, 'SubscriptionBuffer.java'),
  join(androidRoot, 'tests/FrameCodecTest.java'),
  join(androidRoot, 'tests/ForegroundStartGateTest.java'),
  join(androidRoot, 'tests/SubscriptionBufferTest.java'),
]);
for (const name of ['FrameCodecTest', 'ForegroundStartGateTest', 'SubscriptionBufferTest']) {
  run(javaBin('java'), ['-cp', output, `com.pixapps.nearbypoc.${name}`]);
}
