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
# - AdMob (play-services-ads, user-messaging-platform) and Play Billing
#   (com.android.billingclient:billing:8.3.0, used by @capgo/native-purchases)
#   are remote AARs that bundle their own consumer rules; adding broad
#   -keep class com.google.** rules here would only defeat shrinking.
# - @android.webkit.JavascriptInterface members (Capacitor's bridge) are kept
#   by the default proguard-android.txt referenced from build.gradle.
# - capacitor-cordova-android-plugins is generated empty by `cap sync` (no
#   Cordova plugins installed); core's consumer rules cover Cordova plugin
#   subclasses anyway.
#
# If a future plugin breaks under R8, add a targeted keep for its real FQCN
# here with a comment naming the plugin — never a wildcard package keep.

# Keep file/line info so release crash stacks stay mappable via the
# mapping.txt produced by the release build (docs/RELEASE_CHECKLIST.md).
-keepattributes SourceFile,LineNumberTable
# Hide the original source file name in stack traces while keeping line info.
-renamesourcefileattribute SourceFile
