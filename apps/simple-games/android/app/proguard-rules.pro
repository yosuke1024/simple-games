# App-specific R8/ProGuard rules. Applied only to the release build type
# (app/build.gradle sets minifyEnabled/shrinkResources there).
#
# Why this file is small — audit of every subproject in
# capacitor.settings.gradle (Capacitor 8.4.2, plugin versions pinned by
# pnpm-lock.yaml):
#
# - @capacitor/android declares `consumerProguardFiles 'proguard-rules.pro'`
#   in its defaultConfig, and it is a direct project dependency of :app, so
#   AGP merges its rules into this build. Those rules keep every
#   @com.getcapacitor.annotation.CapacitorPlugin class (with @PluginMethod /
#   @PermissionCallback / @ActivityCallback / @Permission members) and every
#   class extending com.getcapacitor.Plugin. That matters because Capacitor
#   loads plugins reflectively from assets/capacitor.plugins.json — R8 cannot
#   see that reachability on its own. Do NOT duplicate those rules here; they
#   are versioned with the framework and propagate automatically.
# - None of the other plugin subprojects (capacitor-community-admob,
#   capacitor-community-in-app-review, capacitor-app, capacitor-haptics,
#   capacitor-network, capacitor-preferences, capacitor-splash-screen,
#   capgo-native-purchases) ship consumer rules, but each one's entry class
#   (e.g. com.getcapacitor.community.admob.AdMob,
#   ee.forgr.nativepurchases.NativePurchasesPlugin) is @CapacitorPlugin-
#   annotated and extends com.getcapacitor.Plugin, so the core rules above
#   keep them. No per-plugin keeps needed.
# - The app's own local plugin, com.pixapps.simplegames.HomeShortcutPlugin
#   (issue #110), is @CapacitorPlugin-annotated and extends
#   com.getcapacitor.Plugin just like the packaged plugins above, so
#   @capacitor/android's consumer rules keep it too — no rule needed here.
#   androidx.core, which it uses for ShortcutManagerCompat/IconCompat, ships
#   its own consumer rules.
# - AdMob (play-services-ads, user-messaging-platform) and Play Billing
#   (com.android.billingclient:billing:8.3.0, used by @capgo/native-purchases)
#   are remote AARs that bundle their own consumer rules; adding broad
#   -keep class com.google.** rules here would only defeat shrinking.
# - @android.webkit.JavascriptInterface members (Capacitor's bridge) are kept
#   by AGP's default proguard-android-optimize.txt referenced from build.gradle.
# - capacitor-cordova-android-plugins is generated empty by `cap sync` (no
#   Cordova plugins installed); core's consumer rules cover Cordova plugin
#   subclasses anyway.
#
# If a future plugin breaks under R8, add a targeted keep for its real FQCN
# here with a comment naming the plugin — never a wildcard package keep.

# Capacitor's annotation types themselves. The consumer rules above keep the
# classes and members that CARRY these annotations, not the annotation
# interfaces. Since 1.7.0 the release build runs R8's optimizer
# (proguard-android-optimize.txt), and it sees no instance of an annotation
# interface anywhere in the program — the runtime makes them reflectively — so
# it treats a value typed as one as always null. PluginHandle keeps the
# @CapacitorPlugin it read in a field; Bridge.getPermissionStates reads
# permissions() from that field, and R8 compiled the call to `throw null`.
# Every permission check crashed the app: Nearby over Bluetooth (BLE needs
# BLUETOOTH_SCAN / ADVERTISE / CONNECT) closed on both Host and Find, while
# Wi-Fi, which asks for no permission, kept working. Keeping the interfaces
# tells R8 that instances exist outside its view.
-keep @interface com.getcapacitor.annotation.CapacitorPlugin { *; }
-keep @interface com.getcapacitor.annotation.Permission { *; }
-keep @interface com.getcapacitor.annotation.PermissionCallback { *; }
-keep @interface com.getcapacitor.annotation.ActivityCallback { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }

# Keep file/line info so release crash stacks stay mappable. The AAB carries
# the mapping (BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map),
# so Play Console deobfuscates crashes without a separate upload.
-keepattributes SourceFile,LineNumberTable
# Hide the original source file name in stack traces while keeping line info.
-renamesourcefileattribute SourceFile
