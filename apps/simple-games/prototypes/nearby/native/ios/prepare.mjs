#!/usr/bin/env node
// Only modifies the gitignored iOS project beside this PoC, never the shipping app.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const pocRoot = path.resolve(sourceDir, '../..');
const generated = path.join(pocRoot, 'ios/App');
const projectPath = path.join(generated, 'App.xcodeproj/project.pbxproj');
const storyboardPath = path.join(generated, 'App/Base.lproj/Main.storyboard');
const plistPath = path.join(generated, 'App/Info.plist');
const sourceNames = ['NearbyPocPlugin.swift', 'NearbyPocViewController.swift'];
const expectedKeys = [
  'NSBluetoothAlwaysUsageDescription',
  'NSLocalNetworkUsageDescription',
  'NSBonjourServices',
];
const bundleId = 'com.pixapps.nearbypoc';

function requireShape(condition, message) {
  if (!condition) throw new Error(`Nearby iOS preparation refused: ${message}`);
}

function parsePlist(text) {
  return JSON.parse(
    execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', '-'], {
      input: text,
      encoding: 'utf8',
    }),
  );
}

function asXML(value) {
  return execFileSync('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', '-'], {
    input: JSON.stringify(value),
    encoding: 'utf8',
  });
}

function exactlyOne(entries, description) {
  requireShape(entries.length === 1, `expected one ${description}, found ${entries.length}`);
  return entries[0];
}

function replaceOnce(text, needle, replacement, description) {
  requireShape(text.split(needle).length === 2, `expected one ${description}`);
  return text.replace(needle, replacement);
}

function addListEntries(text, objectId, listName, lines) {
  const block = exactlyOne(
    [...text.matchAll(new RegExp(`\\t\\t${objectId}[^\\n]* = \\{[\\s\\S]*?\\n\\t\\t\\};`, 'g'))],
    `${objectId} object`,
  )[0];
  const opening = `\t\t\t${listName} = (\n`;
  return replaceOnce(
    text,
    block,
    replaceOnce(block, opening, opening + lines, `${listName} list`),
    `${objectId} block`,
  );
}

function objectId(name, kind) {
  return createHash('sha256')
    .update(`simple-games-nearby-poc:${kind}:${name}`)
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();
}

// Validate every input and prepare every edit before writing generated files.
requireShape(process.platform === 'darwin', 'run this iOS preparation step on macOS with Xcode');
requireShape((await realpath(generated)) === generated, 'generated ios/App must not be a symlink');
for (const target of [projectPath, storyboardPath, plistPath]) {
  requireShape(
    (await realpath(target)) === target,
    `generated input must not traverse a symlink: ${target}`,
  );
}
const config = JSON.parse(await readFile(path.join(pocRoot, 'capacitor.config.json'), 'utf8'));
requireShape(config.appId === bundleId, 'unexpected PoC appId');
const [projectText, storyboardText, plistText, extraText, ...sources] = await Promise.all([
  readFile(projectPath, 'utf8'),
  readFile(storyboardPath, 'utf8'),
  readFile(plistPath, 'utf8'),
  readFile(path.join(sourceDir, 'Info.extra.plist'), 'utf8'),
  ...sourceNames.map((name) => readFile(path.join(sourceDir, name), 'utf8')),
]);
const project = parsePlist(projectText);
const objects = project.objects;
requireShape(objects && typeof objects === 'object', 'missing project objects');
const entries = Object.entries(objects);
const [targetId, target] = exactlyOne(
  entries.filter(([, value]) => value.isa === 'PBXNativeTarget'),
  'native target',
);
requireShape(
  target.name === 'App' && target.productType === 'com.apple.product-type.application',
  'unexpected target',
);
const [groupId, group] = exactlyOne(
  entries.filter(([, value]) => value.isa === 'PBXGroup' && value.path === 'App'),
  'App source group',
);
requireShape(
  group.sourceTree === '<group>' && Array.isArray(group.children),
  'unexpected App group',
);
const [sourcesId, sourcePhase] = exactlyOne(
  target.buildPhases
    .map((id) => [id, objects[id]])
    .filter(([, value]) => value?.isa === 'PBXSourcesBuildPhase'),
  'App Compile Sources phase',
);
requireShape(Array.isArray(sourcePhase.files), 'invalid Compile Sources phase');
const targetConfigurations = objects[target.buildConfigurationList]?.buildConfigurations?.map(
  (id) => objects[id],
);
requireShape(
  targetConfigurations?.length === 2 &&
    targetConfigurations.every(
      (value) =>
        value?.isa === 'XCBuildConfiguration' &&
        value.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER === bundleId &&
        value.buildSettings?.INFOPLIST_FILE === 'App/Info.plist' &&
        Number(value.buildSettings?.IPHONEOS_DEPLOYMENT_TARGET) >= 15,
    ),
  'unexpected app build settings',
);
requireShape(
  objects[project.rootObject]?.targets?.length === 1 &&
    objects[project.rootObject].targets[0] === targetId,
  'unexpected project target list',
);
const [delegateId] = exactlyOne(
  entries.filter(
    ([, value]) => value.isa === 'PBXFileReference' && value.path === 'AppDelegate.swift',
  ),
  'AppDelegate reference',
);
requireShape(
  group.children.includes(delegateId) &&
    sourcePhase.files.some((id) => objects[id]?.fileRef === delegateId),
  'AppDelegate is not registered in App',
);

let patchedProject = projectText;
for (const name of sourceNames) {
  const fileId = objectId(name, 'file');
  const buildId = objectId(name, 'build');
  const references = entries.filter(
    ([, value]) => value.isa === 'PBXFileReference' && value.path === name,
  );
  const exists = references.length > 0 || objects[fileId] || objects[buildId];
  if (exists) {
    requireShape(
      references.length === 1 &&
        references[0][0] === fileId &&
        objects[fileId]?.isa === 'PBXFileReference' &&
        objects[fileId].sourceTree === '<group>' &&
        objects[buildId]?.isa === 'PBXBuildFile' &&
        objects[buildId].fileRef === fileId &&
        group.children.filter((id) => id === fileId).length === 1 &&
        sourcePhase.files.filter((id) => id === buildId).length === 1,
      `partial, duplicate or conflicting registration for ${name}`,
    );
    continue;
  }
  patchedProject = replaceOnce(
    patchedProject,
    '/* End PBXBuildFile section */',
    `\t\t${buildId} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileId} /* ${name} */; };\n/* End PBXBuildFile section */`,
    'PBXBuildFile section',
  );
  patchedProject = replaceOnce(
    patchedProject,
    '/* End PBXFileReference section */',
    `\t\t${fileId} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`,
    'PBXFileReference section',
  );
  patchedProject = addListEntries(
    patchedProject,
    groupId,
    'children',
    `\t\t\t\t${fileId} /* ${name} */,\n`,
  );
  patchedProject = addListEntries(
    patchedProject,
    sourcesId,
    'files',
    `\t\t\t\t${buildId} /* ${name} in Sources */,\n`,
  );
}
const checkedProject = parsePlist(patchedProject);
for (const name of sourceNames) {
  requireShape(
    checkedProject.objects[groupId].children.includes(objectId(name, 'file')) &&
      checkedProject.objects[sourcesId].files.includes(objectId(name, 'build')),
    `failed registration for ${name}`,
  );
}

const scene = exactlyOne(
  [...storyboardText.matchAll(/<viewController\b[^>]*\/>/g)],
  'storyboard bridge view controller',
)[0];
const originalClass = 'customClass="CAPBridgeViewController" customModule="Capacitor"';
const preparedClass = 'customClass="NearbyPocViewController" customModule="App"';
requireShape(
  scene.includes(originalClass) || scene.includes(preparedClass),
  'unknown storyboard controller class/module',
);
const patchedStoryboard = scene.includes(originalClass)
  ? replaceOnce(storyboardText, originalClass, preparedClass, 'storyboard controller registration')
  : storyboardText;
const info = parsePlist(plistText);
const extra = parsePlist(extraText);
requireShape(
  Object.keys(extra).length === expectedKeys.length && expectedKeys.every((key) => key in extra),
  'unexpected permission keys',
);
requireShape(
  typeof extra.NSBluetoothAlwaysUsageDescription === 'string' &&
    typeof extra.NSLocalNetworkUsageDescription === 'string' &&
    JSON.stringify(extra.NSBonjourServices) === JSON.stringify(['_sgnearby._tcp']),
  'unexpected permission values',
);
requireShape(!('UIBackgroundModes' in info), 'background modes are not permitted in this PoC');
requireShape(
  info.CFBundleIdentifier === '$(PRODUCT_BUNDLE_IDENTIFIER)' &&
    info.UIMainStoryboardFile === 'Main',
  'unexpected generated Info.plist',
);
const patchedInfo = asXML({ ...info, ...extra });

for (const name of sourceNames) {
  const destination = path.join(generated, 'App', name);
  try {
    requireShape(
      (await lstat(destination)).isFile(),
      `source destination must be a regular file: ${name}`,
    );
    requireShape(
      (await realpath(destination)) === destination,
      `source destination must not be a symlink: ${name}`,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
await writeFile(projectPath, patchedProject);
await writeFile(storyboardPath, patchedStoryboard);
await writeFile(plistPath, patchedInfo);
for (let index = 0; index < sourceNames.length; index += 1) {
  await writeFile(path.join(generated, 'App', sourceNames[index]), sources[index]);
}
console.log('Prepared isolated Nearby PoC iOS plugin, storyboard and permissions.');
