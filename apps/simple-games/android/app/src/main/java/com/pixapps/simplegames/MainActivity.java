package com.pixapps.simplegames;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The WebView's text zoom never goes above this, whatever Android's font
    // size is set to (docs/PRODUCT_PRINCIPLES.md「Android の文字の倍率」).
    // Unless the app sets one, the WebView's text zoom is fontScale × 100
    // (Chromium's AwSettings): text grows while the screen does not. The games
    // that size their board from the screen height count their bars at the
    // height they take at 100%, and at 130% fourteen games broke, at 200%
    // boards ran under the banner (docs/plans/2026-10-30-android-os-text-size.md).
    // Smaller settings still apply. Raising it needs the measurements the
    // principle lists first; .github/scripts/check-principles.sh §9 pins the
    // value and the shape of this file.
    static final int TEXT_ZOOM_CAP_PERCENT = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge is built, which
        // super.onCreate does. HomeShortcut pins a game to the home screen on
        // request (issue #110). MetaInstall is the Meta install measurement
        // (issue #204), which acts on its own when the bridge loads it: which
        // of its two versions this is — the real one or the empty stub — is
        // decided by the build (app/build.gradle, src/metaOn vs src/metaOff),
        // not here. The packaged plugins load from capacitor.plugins.json on
        // their own.
        registerPlugin(HomeShortcutPlugin.class);
        registerPlugin(MetaInstallPlugin.class);
        // Registration is idle: Nearby Play starts radio work only on explicit UI action.
        registerPlugin(com.pixapps.simplegames.nearby.NearbyPlayPlugin.class);
        super.onCreate(savedInstanceState);
        // The bridge has asked for the page, but nothing is laid out before this
        // main-thread task ends. A font size change recreates the activity
        // (fontScale is not in the manifest's configChanges), so this runs again.
        capTextZoom(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Same value unless fontScale joins configChanges: the WebView would
        // then outlive the change and keep the zoom it had.
        capTextZoom(newConfig);
    }

    private void capTextZoom(Configuration config) {
        // No bridge when BridgeActivity fell back to its no-WebView layout.
        if (bridge == null) return;
        int percent = Math.min(Math.round(config.fontScale * 100), TEXT_ZOOM_CAP_PERCENT);
        bridge.getWebView().getSettings().setTextZoom(percent);
    }
}
