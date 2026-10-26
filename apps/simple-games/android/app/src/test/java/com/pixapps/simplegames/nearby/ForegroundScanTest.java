package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public final class ForegroundScanTest {
    private static final class Radio implements ForegroundScan.Driver {
        final List<Long> started = new ArrayList<>();
        int stops;
        boolean denied;
        public void start(long generation) {
            started.add(generation);
            if (denied) throw new SecurityException("Permission revoked");
        }
        public void stop() { stops++; }
    }

    @Test public void pauseStopsRadioAndResumeUsesANewCallbackGeneration() {
        Radio radio = new Radio();
        ForegroundScan scan = new ForegroundScan(radio);
        scan.start();
        long first = radio.started.get(0);
        assertTrue(scan.accepts(first));
        scan.setForeground(false);
        scan.setForeground(false);
        assertEquals(1, radio.stops);
        assertFalse(scan.accepts(first));
        scan.setForeground(true);
        scan.setForeground(true);
        assertEquals(2, radio.started.size());
        assertFalse(scan.accepts(first)); // A delayed scan result/failure cannot affect the resumed scan.
        assertTrue(scan.accepts(radio.started.get(1)));
    }

    @Test public void stopWhilePausedPreventsResumeAfterSelectionOrExplicitExit() {
        Radio radio = new Radio();
        ForegroundScan scan = new ForegroundScan(radio);
        scan.start();
        long old = radio.started.get(0);
        scan.setForeground(false);
        scan.stop(); // Used both by connect(peer) and by transport.stop().
        scan.setForeground(true);
        scan.setForeground(false);
        scan.setForeground(true);
        assertEquals(1, radio.started.size());
        assertEquals(1, radio.stops);
        assertFalse(scan.accepts(old));
    }

    @Test public void completedDiscoveryCannotRestartOnLaterLifecycleEvents() {
        Radio radio = new Radio();
        ForegroundScan scan = new ForegroundScan(radio);
        scan.start();
        scan.stop();
        scan.stop();
        scan.setForeground(false);
        scan.setForeground(true);
        assertEquals(1, radio.started.size());
        assertEquals(1, radio.stops);
        assertFalse(scan.accepts(radio.started.get(0)));
    }

    @Test public void advertisingOrConnectedOwnerWithoutDiscoveryNeverStartsAScan() {
        Radio radio = new Radio();
        ForegroundScan scan = new ForegroundScan(radio);
        scan.setForeground(false);
        scan.setForeground(true);
        scan.stop();
        assertTrue(radio.started.isEmpty());
        assertEquals(0, radio.stops);
    }

    @Test public void startupWaitsForForegroundAndFailureDoesNotAutomaticallyRetry() {
        Radio radio = new Radio();
        ForegroundScan scan = new ForegroundScan(radio);
        scan.setForeground(false);
        scan.start();
        assertTrue(radio.started.isEmpty());
        radio.denied = true;
        assertThrows(SecurityException.class, () -> scan.setForeground(true));
        assertFalse(scan.accepts(radio.started.get(0)));
        scan.setForeground(false);
        radio.denied = false;
        scan.setForeground(true);
        assertEquals(1, radio.started.size());
        assertEquals(1, radio.stops);
        scan.start(); // Only a new explicit request can start again after failure.
        assertEquals(2, radio.started.size());
        assertTrue(scan.accepts(radio.started.get(1)));
    }
}
