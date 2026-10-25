import UIKit
import Capacitor

/// Set the generated PoC Main.storyboard bridge scene to this class/module App.
/// Do not replace the shipping application's MainViewController.
final class NearbyPocViewController: CAPBridgeViewController {
    private let nearby = NearbyPocPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(nearby)
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        nearby.shutdown()
    }

    deinit { nearby.shutdown() }
}
