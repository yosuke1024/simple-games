import UIKit
import Capacitor

/**
 The app's bridge view controller. Main.storyboard instantiates this instead
 of Capacitor's own so the local plugins can be registered — Capacitor's
 documented way to add native code without a package: subclass, override
 `capacitorDidLoad`, register. The counterpart of MainActivity.java on
 Android, which registers HomeShortcutPlugin the same way. The packaged
 plugins load from capacitor.config.json on their own.
 */
class MainViewController: CAPBridgeViewController {
    private let nearbyPlay = NearbyPlayPlugin()

    override func capacitorDidLoad() {
        // Mirrors the favourites shelf onto the Home Screen quick actions
        // (issue #114). Registration happens here because the bridge exists
        // by this point and the web view has not loaded yet, so the plugin
        // is in place before any JavaScript can call it.
        bridge?.registerPluginInstance(QuickActionsPlugin())
        // Registration is inert: Bluetooth/Wi-Fi discovery and permissions start
        // only when the person explicitly creates or searches for a nearby room.
        bridge?.registerPluginInstance(nearbyPlay)
    }

    // A modal or app switch is not a user exit from the nearby gathering.
    // The plugin observes lifecycle changes and buffers events until return.
    deinit { nearbyPlay.shutdown() }
}
