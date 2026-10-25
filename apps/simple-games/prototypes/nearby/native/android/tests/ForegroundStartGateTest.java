package com.pixapps.nearbypoc;

public final class ForegroundStartGateTest {
    private static void check(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void main(String[] args) {
        ForegroundStartGate permissionDialog = new ForegroundStartGate();
        check(permissionDialog.isForeground());
        permissionDialog.pause();
        check(!permissionDialog.permissionGranted()); // No I/O under the prompt.
        check(permissionDialog.resume()); // Complete exactly the user's pending start on return.
        check(!permissionDialog.resume()); // No automatic second start.

        ForegroundStartGate backgroundBeforeResult = new ForegroundStartGate();
        backgroundBeforeResult.pause();
        backgroundBeforeResult.background(); // Plugin rejects and clears pendingStart here.
        check(!backgroundBeforeResult.resume());

        ForegroundStartGate backgroundAfterResult = new ForegroundStartGate();
        backgroundAfterResult.pause();
        check(!backgroundAfterResult.permissionGranted());
        backgroundAfterResult.background();
        check(!backgroundAfterResult.resume()); // A permission grant never resurrects a stopped session.

        ForegroundStartGate cancelledPrompt = new ForegroundStartGate();
        cancelledPrompt.pause();
        check(!cancelledPrompt.permissionGranted());
        cancelledPrompt.clearPending();
        check(!cancelledPrompt.resume()); // Explicit stop/denial cancels deferred start.

        ForegroundStartGate noPause = new ForegroundStartGate();
        check(noPause.permissionGranted());
        check(!noPause.resume());
        System.out.println("ForegroundStartGate: 11 checks passed");
    }
}
