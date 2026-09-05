import Foundation
import UIKit
import Capacitor

/**
 Mirrors the favourites shelf onto the Home Screen quick actions — the menu a
 long press on the app icon opens (issue #114).

 The whole of the native side of that feature's WRITING half. The JavaScript
 in src/services/homeShortcut/quickActions.ts decides what is listed (which
 games, in which order, how many, the title and the URI each item carries) and
 this class hands the list to UIKit. Nothing here knows what a game or a
 favourite is. Reading a tapped item back is AppDelegate.swift's job: it turns
 the item into the same URL-open Capacitor's App plugin already reports, so
 there is no reading side here and no second contract for the JavaScript to
 learn — a quick action arrives exactly the way an Android shortcut does.

 Every call resolves. An entry missing a field is skipped rather than failing
 the whole list, and the assignment itself has no failure iOS reports back.
 The shelf on screen never waits for any of this.

 A local plugin rather than a package — a dozen lines around one UIKit
 property that nothing else would ever use — registered by
 MainViewController.swift, the way MainActivity.java registers
 HomeShortcutPlugin on Android.
 */
@objc(QuickActionsPlugin)
public class QuickActionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "QuickActionsPlugin"
    public let jsName = "QuickActions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setItems", returnType: CAPPluginReturnPromise)
    ]

    /// The `userInfo` key an item carries its address under. AppDelegate reads it back.
    static let urlKey = "url"

    /**
     Replaces the whole list. An empty list removes every item, which is what
     an empty shelf means: no favourites, no quick actions (the OS keeps its
     own entries — "Remove App", "Share App" — and those are not ours).

     The icon is the system's play glyph for every item. Quick-action icons
     are single-colour templates that UIKit takes only by asset name or system
     symbol, so the per-game accent icon Android draws (icon.ts) has no
     counterpart here; the title carries the identity, as it does on the
     collection home.
     */
    @objc func setItems(_ call: CAPPluginCall) {
        let entries = call.getArray("items", JSObject.self) ?? []
        var items: [UIApplicationShortcutItem] = []
        for entry in entries {
            guard let id = entry["id"] as? String, !id.isEmpty,
                  let label = entry["label"] as? String, !label.isEmpty,
                  let uri = entry["uri"] as? String, !uri.isEmpty else {
                continue
            }
            items.append(UIApplicationShortcutItem(
                type: id,
                localizedTitle: label,
                localizedSubtitle: nil,
                icon: UIApplicationShortcutIcon(type: .play),
                userInfo: [QuickActionsPlugin.urlKey: uri as NSString]
            ))
        }
        // UIApplication is main-thread only; plugin calls arrive off it.
        DispatchQueue.main.async {
            UIApplication.shared.shortcutItems = items
            call.resolve()
        }
    }
}
