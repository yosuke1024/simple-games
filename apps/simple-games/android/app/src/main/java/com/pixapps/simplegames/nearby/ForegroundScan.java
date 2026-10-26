package com.pixapps.simplegames.nearby;

/** Pause discovery without ending its owner, and invalidate callbacks from each old scan. */
final class ForegroundScan {
    interface Driver {
        void start(long generation);
        void stop();
    }

    private final Driver driver;
    private boolean requested;
    private boolean foreground = true;
    private volatile boolean running;
    private volatile long generation;

    ForegroundScan(Driver driver) { this.driver = driver; }

    void start() { requested = true; update(); }
    void stop() { requested = false; update(); }
    void setForeground(boolean active) { foreground = active; update(); }
    boolean accepts(long token) { return running && token == generation; }

    private void update() {
        boolean next = requested && foreground;
        if (next == running) return;
        running = next;
        long token = ++generation;
        if (!next) {
            driver.stop();
            return;
        }
        try { driver.start(token); }
        catch (RuntimeException error) {
            // A revoked permission or unavailable radio must not start an implicit retry loop.
            running = false;
            requested = false;
            ++generation;
            try { driver.stop(); } catch (RuntimeException ignored) { /* Keep the original failure. */ }
            throw error;
        }
    }
}
