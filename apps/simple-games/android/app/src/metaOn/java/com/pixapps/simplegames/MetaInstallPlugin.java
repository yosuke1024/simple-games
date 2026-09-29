package com.pixapps.simplegames;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;
import android.util.Log;
import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Properties;
import java.util.Set;
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
 * facebook-core 18.3.0 attaches to it (runbook §4), including the Android
 * advertising ID, and nothing we add. No event of our own, no session
 * tracking (activateApp is never called), no purchase, no user data.
 * JavaScript has no way in: this plugin has no methods, and decides and acts
 * on its own at start-up. The calls this class may not make are refused by
 * .github/scripts/check-principles.sh §8.
 *
 * WHEN
 *
 * There is no question and no switch (the owner's decision of 2026-09-29,
 * runbook §6). The SDK's own start-up hook is removed from the manifest
 * (src/metaOn/AndroidManifest.xml), so none of its code runs until
 * {@link #load} finds every condition true: this is a new install (installed
 * in the last {@link #NEW_INSTALL_WINDOW_MS}, so an update of an old install is
 * never reported as one), the phone is not in a region where this needs
 * consent ({@link #REGIONS_THAT_NEED_CONSENT}), Meta has not yet accepted this
 * install's report, this launch has not tried already, the attempt budget is
 * not spent, and there is a network — or, when only the network is missing,
 * the moment Android's default network comes back.
 *
 * AFTER
 *
 * The SDK records an accepted report in its own preferences. At the next
 * launch {@link #load} reads that record — with Android's API, without loading
 * the SDK — marks the install reported, deletes everything the SDK kept on
 * the device, and never starts the SDK again. The same cleanup follows a
 * Meta-side setting that would turn automatic logging on behind this app's
 * back (runbook §4, the note on UserSettingsManager).
 *
 * The record lives in a file in no_backup/, apart from the WebView's storage:
 * not in the Backup & Restore file, not in Android's own backup, so a phone
 * restored from another is a new install with a report of its own. A file
 * that cannot be read stops the measurement on this install.
 *
 * Every failure is quiet. Nothing here may stop a game, a save, or a purchase
 * from working (docs/OFFLINE_POLICY.md).
 */
@CapacitorPlugin(name = "MetaInstall")
public class MetaInstallPlugin extends Plugin {

    private static final String TAG = "MetaInstall";

    /** Our record, in no_backup/: reported, blocked, attempts. */
    private static final String STATE_FILE = "meta-install.properties";

    /**
     * Launches that may try before the install is given up on. A report that
     * Meta keeps refusing (a misconfigured app, say) must not become an SDK
     * start on every launch forever.
     */
    private static final int MAX_ATTEMPTS = 3;

    /**
     * How new an install must be for its first attempt. An update keeps the
     * first install's time (PackageInfo.firstInstallTime), so a player who has
     * had the app for months and updates to a version with Meta is not
     * reported as an install — that would be a false one in Meta's numbers.
     * Retries of an attempt already made are not held to this window.
     */
    private static final long NEW_INSTALL_WINDOW_MS = 7L * 24 * 60 * 60 * 1000;

    /**
     * Where sending this without asking first needs consent: the EU and the
     * rest of the EEA, the UK and Switzerland, plus the EU's outermost regions
     * and the territories that carry their own ISO code under the same rules.
     * A phone that looks like any of these — by SIM, by network, or by the
     * device's region setting — sends nothing, ever (runbook §6).
     */
    private static final Set<String> REGIONS_THAT_NEED_CONSENT = new HashSet<>(
        Arrays.asList(
            // European Union
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
            "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
            // the rest of the EEA
            "IS", "LI", "NO",
            // United Kingdom and Switzerland
            "GB", "CH",
            // EU outermost regions and Åland, which have their own codes
            "GF", "GP", "MQ", "RE", "YT", "MF", "AX",
            // Gibraltar and the Crown Dependencies
            "GI", "GG", "JE", "IM"
        )
    );

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

    private boolean reported;
    private boolean blocked;
    private int attempts;

    /*
     * Per process, not per plugin instance: if Android recreates the activity,
     * a new bridge builds a new instance of this class in the same process,
     * and "one attempt per launch" and "the SDK is running" are facts about
     * the process. A launch is therefore a process start — an activity opened
     * again in a process Android kept alive does not get a second attempt,
     * which errs on the side of fewer requests (runbook §2). The record in
     * no_backup/ is re-read by each instance.
     */
    private static boolean attemptedThisLaunch;
    private static boolean sdkStarted;

    private ConnectivityManager.NetworkCallback networkWait;

    /**
     * Every field above is read and written under this lock: load() runs on
     * the main thread, the network callback on a system thread, and the SDK
     * is started from a posted task. Per process, like the two flags above.
     */
    private static final Object lock = new Object();

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
            reportIfDueLocked();
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
            if (!reported && !blocked && attempts > 0) {
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
            if (!sdkStarted && (reported || stopped() || attempts == 0)) {
                deleteSdkData(context);
            }
        } catch (Exception e) {
            Log.w(TAG, "startup check failed", e);
        }
    }

    private void reportIfDueLocked() {
        if (!dueExceptNetwork()) return;
        if (!hasNetwork()) {
            waitForNetworkLocked();
            return;
        }
        startAttemptLocked();
    }

    private boolean dueExceptNetwork() {
        return (
            configured &&
            !reported &&
            !blocked &&
            !attemptedThisLaunch &&
            !stopped() &&
            (attempts > 0 || isNewInstall()) &&
            !inRegionThatNeedsConsent()
        );
    }

    /**
     * One wait, for the moment Android's default network can reach the
     * internet — the callback the OS calls anyway, not a poll or a timer —
     * then unregistered. Everything is checked again when it fires.
     */
    private void waitForNetworkLocked() {
        if (networkWait != null) return;
        try {
            ConnectivityManager cm = getContext().getSystemService(ConnectivityManager.class);
            if (cm == null) return;
            networkWait =
                new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                        if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) networkBack();
                    }
                };
            cm.registerDefaultNetworkCallback(networkWait);
        } catch (Exception e) {
            networkWait = null;
            Log.w(TAG, "could not wait for the network", e);
        }
    }

    private void stopWaitingForNetworkLocked() {
        if (networkWait == null) return;
        try {
            ConnectivityManager cm = getContext().getSystemService(ConnectivityManager.class);
            if (cm != null) cm.unregisterNetworkCallback(networkWait);
        } catch (Exception e) {
            Log.w(TAG, "could not stop waiting for the network", e);
        }
        networkWait = null;
    }

    /**
     * The wait ends only when the attempt starts or when something other than
     * the network makes it no longer due. A network that flickers away again
     * before this runs leaves the wait in place for its next return.
     */
    private void networkBack() {
        synchronized (lock) {
            if (networkWait == null) return;
            if (!dueExceptNetwork()) {
                stopWaitingForNetworkLocked();
                return;
            }
            if (!hasNetwork()) return;
            stopWaitingForNetworkLocked();
            startAttemptLocked();
        }
    }

    /** The activity is going away: this instance stops waiting. */
    @Override
    protected void handleOnDestroy() {
        synchronized (lock) {
            stopWaitingForNetworkLocked();
        }
        super.handleOnDestroy();
    }

    /** Spends this launch's attempt and hands the report to the SDK. */
    private void startAttemptLocked() {
        attemptedThisLaunch = true;
        attempts += 1;
        // The attempt is counted before anything goes out, so a crash midway
        // still spends it. A count that cannot be written is not an attempt.
        if (!writeState()) return;

        final Context app = getContext().getApplicationContext();
        new Thread(
            () -> {
                String referrer = metaInstallReferrer(app);
                new Handler(Looper.getMainLooper()).post(() -> startSdkAndReport(app, referrer));
            },
            "MetaInstallReferrer"
        ).start();
    }

    private void startSdkAndReport(Context app, String referrer) {
        synchronized (lock) {
            startSdkAndReportLocked(app, referrer);
        }
    }

    /**
     * The one time the SDK is started. Automatic logging and initialization
     * are set off again before initialization (the manifest already says so);
     * advertising-ID collection, which the manifest leaves off so that nothing
     * reads it before this point, is turned on for this report. The data may
     * be used for measurement and conversions only, and the install report —
     * the SDK's own MOBILE_APP_INSTALL request — is the only thing asked for.
     * `publishInstallAsync` is what `AppEventsLogger.activateApp` calls for the
     * install; calling it directly is what leaves out the session tracking
     * activateApp would start. It is pinned to facebook-core 18.3.0 (the
     * runbook's §4 is read against that version).
     */
    private void startSdkAndReportLocked(Context app, String referrer) {
        if (reported || blocked) return;
        try {
            FacebookSdk.setApplicationId(appId);
            FacebookSdk.setClientToken(clientToken);
            FacebookSdk.setAutoInitEnabled(false);
            FacebookSdk.setAutoLogAppEventsEnabled(false);
            FacebookSdk.setAdvertiserIDCollectionEnabled(true);
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

    /** Installed within the window, by Android's record of the first install. */
    private boolean isNewInstall() {
        try {
            Context context = getContext();
            long installedAt = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).firstInstallTime;
            long age = System.currentTimeMillis() - installedAt;
            return installedAt > 0 && age >= 0 && age < NEW_INSTALL_WINDOW_MS;
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            return false;
        }
    }

    /**
     * Whether any sign of where the phone is — the SIM's country, the mobile
     * network's, the device's region setting — is a region that needs consent.
     * Any one is enough; no sign at all counts as one too. None of these needs
     * a permission.
     */
    private boolean inRegionThatNeedsConsent() {
        String sim = "";
        String network = "";
        try {
            TelephonyManager tm = getContext().getSystemService(TelephonyManager.class);
            if (tm != null) {
                sim = tm.getSimCountryIso();
                network = tm.getNetworkCountryIso();
            }
        } catch (RuntimeException e) {
            // No telephony: the region setting decides.
        }
        String setting = Locale.getDefault().getCountry();
        boolean known = false;
        for (String code : new String[] { sim, network, setting }) {
            if (code == null || code.isEmpty()) continue;
            known = true;
            if (REGIONS_THAT_NEED_CONSENT.contains(code.toUpperCase(Locale.ROOT))) return true;
        }
        return !known;
    }

    /**
     * No further attempt will be made on this install: Meta turned automatic
     * logging on behind this app's back, or the attempts ran out without Meta
     * accepting the report.
     */
    private boolean stopped() {
        return blocked || (!reported && attempts >= MAX_ATTEMPTS);
    }

    // --- our record --------------------------------------------------------

    private File stateFile() {
        return new File(getContext().getNoBackupFilesDir(), STATE_FILE);
    }

    /** A missing file is a new record; a file that cannot be read stops this install. */
    private void readState() {
        File file = stateFile();
        reported = false;
        blocked = false;
        attempts = 0;
        if (!file.exists()) return;
        Properties props = new Properties();
        try (FileInputStream in = new FileInputStream(file)) {
            props.load(in);
            reported = "true".equals(props.getProperty("reported"));
            blocked = "true".equals(props.getProperty("blocked"));
            attempts = Math.max(0, Integer.parseInt(props.getProperty("attempts", "0")));
        } catch (IOException | RuntimeException e) {
            attempts = MAX_ATTEMPTS;
        }
    }

    private boolean writeState() {
        Properties props = new Properties();
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
