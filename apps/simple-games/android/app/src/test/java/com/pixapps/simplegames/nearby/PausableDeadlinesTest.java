package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

public final class PausableDeadlinesTest {
    private static final class Clock implements PausableDeadlines.Scheduler {
        long time;
        final Map<Runnable, Long> pending = new LinkedHashMap<>();
        public void post(Runnable callback, long delay) { pending.put(callback, time + delay); }
        public void remove(Runnable callback) { pending.remove(callback); }
        void advance(long amount) {
            time += amount;
            for (Runnable callback : new ArrayList<>(pending.keySet())) {
                if (pending.getOrDefault(callback, Long.MAX_VALUE) <= time) {
                    pending.remove(callback);
                    callback.run();
                }
            }
        }
    }

    @Test public void resumeGrantsFreshProgressWindowRatherThanImmediateExpiry() {
        Clock clock = new Clock();
        PausableDeadlines deadlines = new PausableDeadlines(clock);
        int[] fired = {0};
        deadlines.post(() -> fired[0]++, 5_000);
        clock.advance(4_999);
        deadlines.setActive(false);
        assertTrue(clock.pending.isEmpty());
        clock.advance(600_000);
        assertEquals(0, fired[0]);
        deadlines.setActive(false); // Duplicate lifecycle events do not schedule extra timers.
        deadlines.setActive(true);
        deadlines.setActive(true);
        clock.advance(4_999);
        assertEquals(0, fired[0]);
        clock.advance(1);
        assertEquals(1, fired[0]);
        assertTrue(clock.pending.isEmpty());
    }

    @Test public void callbackCompletionDuringInactivityCancelsTheOldDeadline() {
        Clock clock = new Clock();
        PausableDeadlines deadlines = new PausableDeadlines(clock);
        int[] fired = {0};
        Runnable writeTimeout = () -> fired[0]++;
        deadlines.post(writeTimeout, 5_000);
        Runnable alreadyQueued = clock.pending.keySet().iterator().next();
        deadlines.setActive(false);
        alreadyQueued.run(); // A queued callback cannot fail the inactive session.
        deadlines.remove(writeTimeout); // Native BLE completion still runs in background.
        deadlines.setActive(true);
        alreadyQueued.run(); // Stale task must remain inert after resume.
        clock.advance(10_000);
        assertEquals(0, fired[0]);
    }

    @Test public void newPartialFrameWhileInactiveGetsItsBudgetOnlyOnResume() {
        Clock clock = new Clock();
        PausableDeadlines deadlines = new PausableDeadlines(clock);
        int[] fired = {0};
        Runnable timeout = () -> fired[0]++;
        deadlines.setActive(false);
        deadlines.post(timeout, 5_000);
        clock.advance(600_000);
        assertTrue(clock.pending.isEmpty());
        deadlines.setActive(true);
        clock.advance(4_999);
        assertEquals(0, fired[0]);
        clock.advance(1);
        assertEquals(1, fired[0]);
    }

    @Test public void replacementAndSessionEndInvalidateOldScheduledCallbacks() {
        Clock clock = new Clock();
        PausableDeadlines deadlines = new PausableDeadlines(clock);
        int[] fired = {0};
        Runnable timeout = () -> fired[0]++;
        deadlines.post(timeout, 100);
        Runnable old = clock.pending.keySet().iterator().next();
        deadlines.post(timeout, 5_000);
        old.run();
        assertEquals(0, fired[0]);
        Runnable replaced = clock.pending.keySet().iterator().next();
        deadlines.clear();
        replaced.run();
        deadlines.setActive(false);
        deadlines.setActive(true);
        clock.advance(10_000);
        assertEquals(0, fired[0]);
        assertTrue(clock.pending.isEmpty());
    }
}
