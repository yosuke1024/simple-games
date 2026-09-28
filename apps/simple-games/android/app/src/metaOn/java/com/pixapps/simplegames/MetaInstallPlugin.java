package com.pixapps.simplegames;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * The Meta install measurement (issue #204, docs/META_ANDROID_ACQUISITION.md):
 * the one place in the app that touches the Meta SDK, compiled only into a
 * release built with SG_META_ANDROID_ENABLED=true (app/build.gradle).
 *
 * WHAT IT SENDS
 *
 * Meta's own install report, MOBILE_APP_INSTALL, once per install — with what
 * facebook-core 18.3.0 attaches to it (runbook §4) and nothing we add. No
 * event of our own, no session tracking (activateApp is never called), no
 * purchase, no advertising ID, no user data. JavaScript cannot add anything:
 * it can read the state, record the player's answer, and say "now"
 * (src/services/acquisition/plugin.ts). The calls this class may not make are
 * refused by .github/scripts/check-principles.sh §8.
 *
 * WHEN
 *
 * The SDK's own start-up hook is removed from the manifest (src/metaOn/
 * AndroidManifest.xml), so none of its code runs until {@link #reportInstall}
 * finds every condition true: the player said yes, Meta has not yet accepted
 * this install's report, this launch has not tried already, the attempt
 * budget is not spent, and there is a network. JavaScript checked the same
 * things; they are checked again here because this is where it is decided.
 *
 * AFTER
 *
 * The SDK records an accepted report in its own preferences. At the next
 * launch {@link #load} reads that record — with Android's API, without loading
 * the SDK — marks the install reported, deletes everything the SDK kept on
 * the device, and never starts the SDK again. The same cleanup follows a "no"
 * and a Meta-side setting that would turn automatic logging on behind this
 * app's back (runbook §4, the note on UserSettingsManager).
 *
 * The player's answer lives in a file in no_backup/, apart from the WebView's
 * storage: not in the Backup & Restore file, not in Android's own backup, so
 * a yes given on one phone is never carried to another. A file that cannot be
 * read is a no.
 *
 * Every failure is quiet. Nothing here may stop a game, a save, or a purchase
 * from working (docs/OFFLINE_POLICY.md).
 */
@CapacitorPlugin(name = "MetaInstall")
public class MetaInstallPlugin extends Plugin {

    private static final String TAG = "MetaInstall";

    /** Our record, in no_backup/: consent, reported, blocked, attempts. */
    private static final String STATE_FILE = "meta-install.properties";

    /**
     * Launches that may try before the install is given up on. A report that
     * Meta keeps refusing (a misconfigured app, say) must not become an SDK
     * start on every launch forever.
     */
    private static final int MAX_ATTEMPTS = 3;

    /** How long to wait for Google Play to hand over the install referrer (a local call). */
    private static final long REFERRER_TIMEOUT_MS = 3000;

    // The SDK's own storage, read without loading the SDK (facebook-core 18.3.0).
    private static final String SDK_ATTRIBUTION_PREFS = "com.facebook.sdk.attributionTracking";
    private static final String SDK_APP_SETTINGS_PREFS = "com.facebook.internal.preferences.APP_SETTINGS";
    private static final String SDK_APP_SETTINGS_KEY = "com.facebook.internal.APP_SETTINGS.";
    private static final String SDK_PREFS_PREFIX = "com.facebook.";

    private static final Pattern APP_ID = Pattern.compile("[0-9]{8,20}");
    private static final Pattern CLIENT_TOKEN = Pattern.compile("[0-9a-f]{32}");

    private String appId = "";
    private String clientToken = "";
    private boolean configured;

    private String consent = "unset";
    private boolean reported;
    private boolean blocked;
    private int attempts;

    private boolean attemptedThisLaunch;
    private boolean sdkStarted;

    /**
     * Every field above is read and written under this lock: plugin calls
     * arrive on Capacitor's plugin thread, the SDK is started on the main
     * thread, and a "no" must not slip between the last check and the start.
     */
    private final Object lock = new Object();

    @Override
    public void load() {
        Context context = getContext();
        try {
            appId = context.getString(R.string.sg_meta_app_id).trim();
            clientToken = context.getString(R.string.sg_meta_client_token).trim();
        } catch (Exception e) {
            appId = "";
            clientToken = "";
        }
        configured = APP_ID.matcher(appId).matches() && CLIENT_TOKEN.matcher(clientToken).matches();
        synchronized (lock) {
            readState();
            if (!configured) return;
            checkLastAttempt(context);
        }
    }

    /**
     * Reads what the SDK recorded during an earlier launch's attempt — only if
     * our own record (no_backup, never restored) says this install made one.
     * Android's backup can carry the SDK's preferences to a new phone; there
     * they describe another install and are deleted, never trusted.
     */
    private void checkLastAttempt(Context context) {
        try {
            if (!reported && !blocked && "granted".equals(consent) && attempts > 0) {
                boolean changed = false;
                if (sdkRecordedAcceptedReport(context)) {
                    reported = true;
                    changed = true;
                }
                if (metaTurnedAutomaticLoggingOn(context)) {
                    blocked = true;
                    changed = true;
                    Log.w(TAG, "Meta app settings enable automatic logging; measurement stays off on this install");
                }
                if (changed) writeState();
            }
            if (!"granted".equals(consent) || reported || stopped() || attempts == 0) {
                deleteSdkData(context);
            }
        } catch (Exception e) {
            Log.w(TAG, "startup check failed", e);
        }
    }

    @PluginMethod
    public void getState(PluginCall call) {
        synchronized (lock) {
            call.resolve(state());
        }
    }

    @PluginMethod
    public void setConsent(PluginCall call) {
        boolean granted = Boolean.TRUE.equals(call.getBoolean("granted", false));
        synchronized (lock) {
            setConsentLocked(call, granted);
        }
    }

    private void setConsentLocked(PluginCall call, boolean granted) {
        String previous = consent;
        consent = granted ? "granted" : "declined";
        if (!writeState()) {
            if (granted) {
                // A yes we could not record is not a yes.
                consent = previous;
                call.reject("could not record the answer");
                return;
            }
            // A no we could not record must still be a no at the next launch,
            // where the file would otherwise read back the old yes. Without
            // the file the next launch reads "never asked" — which sends
            // nothing and clears the SDK's data — so remove it. This launch
            // stays off either way (the field above).
            if (!stateFile().delete() && stateFile().exists()) {
                Log.w(TAG, "could not record or clear the answer; off for this launch only");
            }
        }
        if (!granted) {
            if (sdkStarted) {
                // Already running in this process: take back what can be taken
                // back now. Its files go at the next launch, before it loads.
                try {
                    FacebookSdk.setAdvertiserIDCollectionEnabled(false);
                    FacebookSdk.setAutoLogAppEventsEnabled(false);
                    FacebookSdk.setLimitEventAndDataUsage(getContext(), true);
                } catch (Exception e) {
                    Log.w(TAG, "could not quiet the SDK", e);
                }
            } else {
                deleteSdkData(getContext());
            }
        }
        call.resolve(state());
    }

    @PluginMethod
    public void reportInstall(PluginCall call) {
        synchronized (lock) {
            reportInstallLocked(call);
        }
    }

    private void reportInstallLocked(PluginCall call) {
        JSObject ret = new JSObject();
        boolean due =
            configured &&
            "granted".equals(consent) &&
            !reported &&
            !blocked &&
            !attemptedThisLaunch &&
            !stopped() &&
            hasNetwork();
        if (!due) {
            ret.put("started", false);
            call.resolve(ret);
            return;
        }
        attemptedThisLaunch = true;
        attempts += 1;
        // The attempt is counted before anything goes out, so a crash midway
        // still spends it. A count that cannot be written is not an attempt.
        if (!writeState()) {
            ret.put("started", false);
            call.resolve(ret);
            return;
        }
        ret.put("started", true);
        call.resolve(ret);

        final Context app = getContext().getApplicationContext();
        new Thread(
            () -> {
                String referrer = metaInstallReferrer(app);
                new Handler(Looper.getMainLooper()).post(() -> startSdkAndReport(app, referrer));
            },
            "MetaInstallReferrer"
        ).start();
    }

    /**
     * The one time the SDK is started. Everything automatic is set off again
     * before initialization (the manifest already says so), the data may be
     * used for measurement and conversions only, and the install report —
     * the SDK's own MOBILE_APP_INSTALL request — is the only thing asked for.
     * `publishInstallAsync` is what `AppEventsLogger.activateApp` calls for the
     * install; calling it directly is what leaves out the session tracking
     * activateApp would start. It is pinned to facebook-core 18.3.0 (the
     * runbook's §4 is read against that version).
     */
    private void startSdkAndReport(Context app, String referrer) {
        synchronized (lock) {
            startSdkAndReportLocked(app, referrer);
        }
    }

    /**
     * Holding the lock across the start means a "no" is either seen here —
     * and nothing starts — or arrives after the report was handed to the
     * SDK, which is the one report a later "no" cannot recall (runbook §6).
     */
    private void startSdkAndReportLocked(Context app, String referrer) {
        if (!"granted".equals(consent) || reported || blocked) return;
        try {
            FacebookSdk.setApplicationId(appId);
            FacebookSdk.setClientToken(clientToken);
            FacebookSdk.setAutoInitEnabled(false);
            FacebookSdk.setAutoLogAppEventsEnabled(false);
            FacebookSdk.setAdvertiserIDCollectionEnabled(false);
            FacebookSdk.sdkInitialize(app);
            FacebookSdk.fullyInitialize();
            FacebookSdk.setLimitEventAndDataUsage(app, true);
            if (referrer != null) AppEventsLogger.setInstallReferrer(referrer);
            sdkStarted = true;
            FacebookSdk.publishInstallAsync(app, appId);
        } catch (Exception e) {
            Log.w(TAG, "install report not started", e);
        }
    }

    /**
     * The Google Play install referrer, only when it came from a Meta ad —
     * the same test the SDK applies to what it reads itself ("fb" or
     * "facebook" in the string). Any other referrer is not passed on. Read
     * here because the SDK fetches it asynchronously and its install report
     * does not wait for it (FacebookSdk.publishInstallAndWaitForResponse), so
     * the one report would otherwise usually go without it. A local call to
     * the Play Store app, bounded by a timeout; any failure means no referrer.
     */
    private static String metaInstallReferrer(Context app) {
        final AtomicReference<String> result = new AtomicReference<>(null);
        final CountDownLatch done = new CountDownLatch(1);
        try {
            final InstallReferrerClient client = InstallReferrerClient.newBuilder(app).build();
            client.startConnection(
                new InstallReferrerStateListener() {
                    @Override
                    public void onInstallReferrerSetupFinished(int responseCode) {
                        try {
                            if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                                String referrer = client.getInstallReferrer().getInstallReferrer();
                                if (referrer != null && (referrer.contains("fb") || referrer.contains("facebook"))) {
                                    result.set(referrer);
                                }
                            }
                        } catch (Exception ignored) {
                            // No referrer.
                        } finally {
                            try {
                                client.endConnection();
                            } catch (Exception ignored) {
                                // Already closed.
                            }
                            done.countDown();
                        }
                    }

                    @Override
                    public void onInstallReferrerServiceDisconnected() {
                        done.countDown();
                    }
                }
            );
            done.await(REFERRER_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            return null;
        }
        return result.get();
    }

    private boolean hasNetwork() {
        try {
            ConnectivityManager cm = getContext().getSystemService(ConnectivityManager.class);
            if (cm == null) return false;
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * No further attempt will be made on this install: Meta turned automatic
     * logging on behind this app's back, or the attempts ran out without Meta
     * accepting the report. The switch stays in Settings either way — the
     * answer is still the player's to change — but nothing is tried again.
     */
    private boolean stopped() {
        return blocked || (!reported && attempts >= MAX_ATTEMPTS);
    }

    private JSObject state() {
        JSObject ret = new JSObject();
        ret.put("available", configured);
        ret.put("consent", consent);
        ret.put("reported", reported);
        ret.put("stopped", !reported && stopped());
        ret.put("installedAt", installedAt());
        return ret;
    }

    private long installedAt() {
        try {
            Context context = getContext();
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0).firstInstallTime;
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            return 0;
        }
    }

    // --- our record --------------------------------------------------------

    private File stateFile() {
        return new File(getContext().getNoBackupFilesDir(), STATE_FILE);
    }

    /** A missing file is "never asked"; a file that cannot be read is a no. */
    private void readState() {
        File file = stateFile();
        if (!file.exists()) {
            consent = "unset";
            return;
        }
        Properties props = new Properties();
        try (FileInputStream in = new FileInputStream(file)) {
            props.load(in);
            String value = props.getProperty("consent", "declined");
            consent = "granted".equals(value) ? "granted" : "declined";
            reported = "true".equals(props.getProperty("reported"));
            blocked = "true".equals(props.getProperty("blocked"));
            attempts = Math.max(0, Integer.parseInt(props.getProperty("attempts", "0")));
        } catch (IOException | RuntimeException e) {
            consent = "declined";
            reported = false;
            blocked = false;
            attempts = MAX_ATTEMPTS;
        }
    }

    private boolean writeState() {
        Properties props = new Properties();
        props.setProperty("consent", consent);
        props.setProperty("reported", Boolean.toString(reported));
        props.setProperty("blocked", Boolean.toString(blocked));
        props.setProperty("attempts", Integer.toString(attempts));
        File file = stateFile();
        File tmp = new File(file.getParentFile(), STATE_FILE + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            props.store(out, null);
            out.getFD().sync();
        } catch (IOException | RuntimeException e) {
            return false;
        }
        return tmp.renameTo(file);
    }

    // --- the SDK's storage, handled without loading the SDK ------------------

    /** Whether the SDK recorded that Meta accepted this install's report. */
    private boolean sdkRecordedAcceptedReport(Context context) {
        if (!sdkPrefsFile(context, SDK_ATTRIBUTION_PREFS).exists()) return false;
        SharedPreferences prefs = context.getSharedPreferences(SDK_ATTRIBUTION_PREFS, Context.MODE_PRIVATE);
        return prefs.getLong(appId + "ping", 0) > 0;
    }

    /**
     * Whether the app settings the SDK fetched from Meta turn automatic
     * logging on. In facebook-core 18.3.0 that value outranks the manifest's
     * AutoLogAppEventsEnabled=false (UserSettingsManager.checkAutoLogAppEventsEnabled),
     * so a Meta-side setting could switch on what this app switched off. The
     * runbook (§8) requires it off on Meta's side; this is what happens if it
     * is not.
     */
    private boolean metaTurnedAutomaticLoggingOn(Context context) {
        if (!sdkPrefsFile(context, SDK_APP_SETTINGS_PREFS).exists()) return false;
        try {
            String json = context
                .getSharedPreferences(SDK_APP_SETTINGS_PREFS, Context.MODE_PRIVATE)
                .getString(SDK_APP_SETTINGS_KEY + appId, null);
            if (json == null || json.isEmpty()) return false;
            JSONObject settings = new JSONObject(json);
            return !settings.isNull("auto_log_app_events_enabled") && settings.optBoolean("auto_log_app_events_enabled", false);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Deletes everything facebook-core keeps on the device: its preferences
     * (anon_id, the accepted-report record, cached settings and gatekeepers),
     * queued events, downloaded models and crash reports. Only ever called
     * while the SDK is not running in this process.
     */
    private static void deleteSdkData(Context context) {
        try {
            File prefsDir = new File(context.getApplicationInfo().dataDir, "shared_prefs");
            File[] files = prefsDir.listFiles();
            if (files != null) {
                for (File file : files) {
                    String name = file.getName();
                    if (name.startsWith(SDK_PREFS_PREFIX) && name.endsWith(".xml")) {
                        context.deleteSharedPreferences(name.substring(0, name.length() - ".xml".length()));
                    }
                }
            }
            deleteRecursively(new File(context.getFilesDir(), "AppEventsLogger.persistedevents"));
            deleteRecursively(new File(context.getFilesDir(), "facebook_ml"));
            deleteRecursively(new File(context.getCacheDir(), "instrument"));
        } catch (Exception e) {
            Log.w(TAG, "could not delete the SDK's data", e);
        }
    }

    private static File sdkPrefsFile(Context context, String name) {
        return new File(new File(context.getApplicationInfo().dataDir, "shared_prefs"), name + ".xml");
    }

    private static void deleteRecursively(File file) {
        if (!file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) deleteRecursively(child);
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }
}
