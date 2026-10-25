package com.pixapps.simplegames;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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
    }
}
