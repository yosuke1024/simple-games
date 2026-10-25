package com.pixapps.nearbypoc;

/** A permission dialog may pause without stopping the Activity. A real stop cancels the intent. */
final class ForegroundStartGate {
    private boolean foreground = true;
    private boolean grantedWhilePaused;

    boolean isForeground() { return foreground; }
    void pause() { foreground = false; }
    boolean permissionGranted() {
        grantedWhilePaused = !foreground;
        return foreground;
    }
    boolean resume() {
        foreground = true;
        boolean continuePermissionStart = grantedWhilePaused;
        grantedWhilePaused = false;
        return continuePermissionStart;
    }
    void clearPending() { grantedWhilePaused = false; }
    void background() { foreground = false; clearPending(); }
}
