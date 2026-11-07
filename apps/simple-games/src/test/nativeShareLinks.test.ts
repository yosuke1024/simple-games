import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('native share URL registration', () => {
  it('claims only shared HTTPS links on pixapps.ai and preserves Club House', () => {
    const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    const filters = [...manifest.matchAll(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g)].map(
      (m) => m[0],
    );
    const share = filters.filter((filter) => filter.includes('android:host="pixapps.ai"'));
    expect(share).toHaveLength(1);
    expect(share[0]).toContain('android:autoVerify="true"');
    expect(share[0]).toContain('android:scheme="https"');
    expect(share[0]).toContain('android:pathPrefix="/simple-games/share/"');
    expect(share[0]).not.toContain('/play/');
    expect(
      filters.some(
        (filter) =>
          filter.includes('android:host="club.pixapps.ai"') &&
          filter.includes('android:path="/join"'),
      ),
    ).toBe(true);
    expect(
      filters.some(
        (filter) =>
          filter.includes('android:scheme="com.pixapps.simplegames"') &&
          filter.includes('android:host="share"'),
      ),
    ).toBe(true);
  });

  it('associates iOS with both hosts and declares the explicit LP fallback scheme', () => {
    const entitlement = readFileSync('ios/App/App/App.entitlements', 'utf8');
    expect(entitlement).toContain('<string>applinks:pixapps.ai</string>');
    expect(entitlement).toContain('<string>applinks:club.pixapps.ai</string>');
    const plist = readFileSync('ios/App/App/Info.plist', 'utf8');
    expect(plist).toContain('<key>CFBundleURLSchemes</key>');
    expect(plist).toContain('<string>com.pixapps.simplegames</string>');
    const project = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
    expect(project.match(/CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g)).toHaveLength(2);
  });
});
