package com.pixapps.simplegames;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge is built, which
        // super.onCreate does; this one pins a game to the home screen on
        // request (issue #110). The packaged plugins load from
        // capacitor.plugins.json on their own.
        registerPlugin(HomeShortcutPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
