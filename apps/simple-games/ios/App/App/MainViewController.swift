import UIKit
import Capacitor

/**
 The app's bridge view controller. Main.storyboard instantiates this instead
 of Capacitor's own so the one local plugin can be registered — Capacitor's
 documented way to add native code without a package: subclass, override
 `capacitorDidLoad`, register. The counterpart of MainActivity.java on
 Android, which registers HomeShortcutPlugin the same way. The packaged
 plugins load from capacitor.config.json on their own.
 */
class MainViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        // Mirrors the favourites shelf onto the Home Screen quick actions
        // (issue #114). Registration happens here because the bridge exists
        // by this point and the web view has not loaded yet, so the plugin
        // is in place before any JavaScript can call it.
        bridge?.registerPluginInstance(QuickActionsPlugin())
    }
}
