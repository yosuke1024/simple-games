package com.pixapps.simplegames.nearby;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

/** Process priority for an explicitly started Nearby session; no boot receiver or restart. */
public final class NearbyConnectionService extends Service {
    private static final String CHANNEL = "nearby-play-session";
    private static final String LEASE = "nearby-lease";
    private static final int NOTIFICATION_ID = 268;
    // Accessed on main, like NearbyPlayPlugin and Service lifecycle callbacks.
    private static long nextLease;
    private static long activeLease;
    private static Runnable ownerFailure;
    private long startedLease;
    private boolean foregroundStarted;

    static long retain(Context context, Runnable onFailure) {
        if (activeLease != 0) throw new IllegalStateException("Nearby service is already in use");
        long lease = ++nextLease;
        activeLease = lease;
        ownerFailure = onFailure;
        Intent intent = new Intent(context, NearbyConnectionService.class).putExtra(LEASE, lease);
        try {
            if ((Build.VERSION.SDK_INT >= 26 ? context.startForegroundService(intent) : context.startService(intent)) == null) {
                throw new IllegalStateException("Nearby service is unavailable");
            }
        } catch (RuntimeException error) {
            activeLease = 0;
            ownerFailure = null;
            throw error;
        }
        return lease;
    }

    static void release(Context context, long lease) {
        if (lease == 0 || activeLease != lease) return;
        activeLease = 0;
        ownerFailure = null;
        context.stopService(new Intent(context, NearbyConnectionService.class));
    }

    @Override public void onCreate() {
        super.onCreate();
        try {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = new NotificationChannel(CHANNEL, "Nearby Play", NotificationManager.IMPORTANCE_LOW);
                channel.setSound(null, null);
                channel.enableVibration(false);
                manager.createNotificationChannel(channel);
            }
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch == null) throw new IllegalStateException("App entry unavailable");
            PendingIntent open = PendingIntent.getActivity(this, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
            Notification notification = builder
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(getApplicationInfo().loadLabel(getPackageManager()))
                .setContentText("Nearby Play")
                .setContentIntent(open)
                .setCategory(Notification.CATEGORY_SERVICE)
                .setPriority(Notification.PRIORITY_LOW)
                .setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            else startForeground(NOTIFICATION_ID, notification);
            foregroundStarted = true;
        } catch (RuntimeException error) {
            // onStartCommand reports failure only to the matching live session.
            foregroundStarted = false;
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        long lease = intent == null ? 0 : intent.getLongExtra(LEASE, 0);
        if (lease != 0 && lease == activeLease) {
            startedLease = lease;
            if (!foregroundStarted) { failed(lease); stopSelf(startId); }
        } else if (activeLease == 0) stopSelf(startId);
        return START_NOT_STICKY;
    }

    private static void failed(long lease) {
        if (lease == 0 || lease != activeLease) return;
        Runnable failure = ownerFailure;
        activeLease = 0;
        ownerFailure = null;
        if (failure != null) failure.run();
    }

    @Override public void onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE);
        failed(startedLease);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
