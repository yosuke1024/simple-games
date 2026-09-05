import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // A cold start from a Home Screen quick action (issue #114): the item
        // the player tapped is in the launch options, before any JavaScript
        // runs. Handing it over here, rather than waiting for
        // performActionFor(_:) a moment later, is what lets boot read the game
        // synchronously (`getLaunchUrl`) and paint it as the first screen —
        // the collection never flashes on the way, exactly as on Android.
        // Returning false is Apple's documented way of saying "handled here":
        // UIKit then does not raise performActionFor(_:) for the same item,
        // which would otherwise deliver the launch twice.
        if let item = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            openGame(from: item, in: application)
            return false
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    /**
     A Home Screen quick action tapped while the app is already running — the
     warm start (issue #114). Capacitor's App plugin is loaded by now, so the
     URL-open below reaches the JavaScript as `appUrlOpen`, the same event an
     Android shortcut raises through onNewIntent, and App.tsx switches games.
     */
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(openGame(from: shortcutItem, in: application))
    }

    /**
     Turns a quick action into the URL-open the rest of the app already
     understands. The item carries the game's address — the browser version's
     own `?game=<id>` URL — in its `userInfo` (QuickActionsPlugin.swift), and
     handing that to Capacitor's ApplicationDelegateProxy is exactly what a
     real URL open does: it sets the launch URL `getLaunchUrl()` answers and
     posts the notification the App plugin turns into `appUrlOpen`. Nothing
     here reads the address; app/shortcutLaunch.ts does, with the one parser
     the browser and Android already share, and an id this build no longer
     carries lands on the collection there.

     An item without an address — none is ever written, but a stale one from a
     build this code did not make is not impossible — is simply not a launch
     into a game: the ordinary launch proceeds and the collection opens.
     */
    @discardableResult
    private func openGame(from item: UIApplicationShortcutItem, in application: UIApplication) -> Bool {
        guard let raw = item.userInfo?[QuickActionsPlugin.urlKey] as? String,
              let url = URL(string: raw) else {
            return false
        }
        return ApplicationDelegateProxy.shared.application(application, open: url, options: [:])
    }

}
