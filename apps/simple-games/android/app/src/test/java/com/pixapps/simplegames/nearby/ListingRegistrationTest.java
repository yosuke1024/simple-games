package com.pixapps.simplegames.nearby;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;
import org.junit.Test;

public final class ListingRegistrationTest {
    /** A stand-in for NsdManager: a call starts an operation, and the test delivers its callback. */
    private static final class Radio implements ListingRegistration.Driver {
        final List<String> calls = new ArrayList<>();
        String pending; // "register" or "unregister": at most one may ever be outstanding.
        Boolean live;   // the listing state the network currently shows, null when withdrawn.
        boolean pendingListed;
        boolean failUnregister;
        boolean stopping; // Only stop() may withdraw a registration whose callback is still outstanding.
        public void register(boolean listed) {
            assertNull("A registration started while another operation was in flight", pending);
            calls.add("register:" + listed);
            pending = "register"; pendingListed = listed;
        }
        public void unregister() {
            if (failUnregister) throw new IllegalArgumentException("listener not registered");
            calls.add("unregister");
            assertTrue("Only a registration can be withdrawn", live != null || "register".equals(pending));
            assertTrue("A withdrawal started while another operation was in flight", stopping || pending == null);
            pending = "unregister";
        }
    }
    private final Radio radio = new Radio();
    private final ListingRegistration registration = new ListingRegistration(radio);

    /** The OS reports that the outstanding operation finished. */
    private void complete() {
        String operation = radio.pending;
        assertNotNull("Nothing is in flight", operation);
        radio.pending = null;
        if ("register".equals(operation)) { radio.live = radio.pendingListed; registration.registered(); }
        else { radio.live = null; registration.unregistered(); }
    }
    private void stop() { radio.stopping = true; registration.stop(); }
    private void assertCalls(String... expected) { assertEquals(Arrays.asList(expected), radio.calls); }

    @Test public void listedByDefaultAndQuietOnceRegistered() {
        registration.open();
        complete();
        assertCalls("register:true");
        assertNull(radio.pending);
    }

    @Test public void aRequestBeforeTheFirstRegistrationOnlyRecordsTheWish() {
        registration.setListed(false);
        assertCalls();
        registration.open();
        assertCalls("register:false");
        complete();
        assertCalls("register:false"); // No hide-then-show churn to reach the state it already has.
        assertEquals(Boolean.FALSE, radio.live);
    }

    @Test public void aRequestWhileTheFirstRegistrationIsInFlightWaitsForItsCallback() {
        registration.open();
        registration.setListed(false);
        assertCalls("register:true"); // Never unregister a registration that has not completed.
        complete();
        assertCalls("register:true", "unregister");
        complete();
        assertCalls("register:true", "unregister", "register:false");
        complete();
        assertCalls("register:true", "unregister", "register:false");
        assertEquals(Boolean.FALSE, radio.live);
    }

    @Test public void aSameStateRequestDoesNothing() {
        registration.open();
        complete();
        registration.setListed(true);
        registration.setListed(true);
        assertCalls("register:true");
        registration.setListed(false);
        complete(); complete();
        registration.setListed(false);
        assertCalls("register:true", "unregister", "register:false");
        assertNull(radio.pending);
    }

    @Test public void changingTheStateUnregistersThenRegistersTheSameServiceAgain() {
        registration.open();
        complete();
        registration.setListed(false);
        assertCalls("register:true", "unregister");
        assertEquals("unregister", radio.pending); // The register waits for onServiceUnregistered.
        complete();
        assertCalls("register:true", "unregister", "register:false");
        complete();
        registration.setListed(true);
        complete(); complete();
        assertCalls("register:true", "unregister", "register:false", "unregister", "register:true");
        assertEquals(Boolean.TRUE, radio.live);
    }

    @Test public void rapidTogglesCollapseIntoOneUnregisterAndTheLatestWish() {
        registration.open();
        complete();
        registration.setListed(false);
        registration.setListed(true);
        registration.setListed(false);
        registration.setListed(true);
        registration.setListed(false);
        assertCalls("register:true", "unregister");
        complete();
        assertCalls("register:true", "unregister", "register:false");
        complete();
        assertCalls("register:true", "unregister", "register:false");
        assertEquals(Boolean.FALSE, radio.live);
    }

    @Test public void aWishThatChangesAgainWhileReregisteringLoopsUntilItMatches() {
        registration.open();
        complete();
        registration.setListed(false);
        complete();                       // unregistered -> register:false in flight
        registration.setListed(true);     // changed again before it completed
        assertCalls("register:true", "unregister", "register:false");
        complete();                       // registered(false) -> must correct itself
        assertCalls("register:true", "unregister", "register:false", "unregister");
        complete();
        assertCalls("register:true", "unregister", "register:false", "unregister", "register:true");
        complete();
        assertEquals(Boolean.TRUE, radio.live);
        assertNull(radio.pending);
    }

    @Test public void nothingRegistersAfterStop() {
        registration.open();
        complete();
        registration.setListed(false);    // unregister in flight
        stop();
        assertCalls("register:true", "unregister"); // The in-flight unregister is not repeated.
        complete();                       // late onServiceUnregistered
        registration.setListed(true);
        registration.open();
        assertCalls("register:true", "unregister");
        assertNull(radio.pending);
    }

    @Test public void stopDuringAFirstRegistrationDropsItsLateCallback() {
        registration.open();
        stop();
        assertCalls("register:true", "unregister");
        radio.pending = null;
        registration.registered();        // late onServiceRegistered
        registration.unregistered();
        registration.setListed(false);
        assertCalls("register:true", "unregister");
    }

    @Test public void stopWithdrawsALiveRegistrationExactlyOnce() {
        registration.open();
        complete();
        stop();
        stop();
        assertCalls("register:true", "unregister");
    }

    @Test public void stopBeforeAnyRegistrationTouchesNothing() {
        registration.setListed(false);
        stop();
        registration.open();
        assertCalls();
    }

    @Test public void stopNeverThrowsWhenTheOsRefusesToUnregister() {
        registration.open();
        complete();
        radio.failUnregister = true;
        stop();
        assertCalls("register:true");
    }

    @Test public void aRefusedWithdrawalLeavesTheRegistrationLiveAndTheNextRequestRetries() {
        registration.open();
        complete();
        radio.failUnregister = true;
        assertThrows(IllegalArgumentException.class, () -> registration.setListed(false));
        assertCalls("register:true");     // Nothing was withdrawn, so no callback will ever arrive.
        assertNull(radio.pending);
        assertEquals(Boolean.TRUE, radio.live);
        radio.failUnregister = false;
        registration.setListed(false);    // The wish was kept; asking again is not stuck behind UNREGISTERING.
        assertCalls("register:true", "unregister");
        complete(); complete();
        assertCalls("register:true", "unregister", "register:false");
        assertEquals(Boolean.FALSE, radio.live);
    }

    @Test public void stopStillWithdrawsALiveRegistrationAfterARefusedWithdrawal() {
        registration.open();
        complete();
        radio.failUnregister = true;
        assertThrows(IllegalArgumentException.class, () -> registration.setListed(false));
        radio.failUnregister = false;
        stop();
        assertCalls("register:true", "unregister");
    }

    @Test public void strayCallbacksDoNotStartOperations() {
        registration.unregistered();
        registration.registered();
        assertCalls();
        registration.open();
        complete();
        registration.registered();        // duplicate
        registration.unregistered();      // nothing was being unregistered
        assertCalls("register:true");
        assertNull(radio.pending);
    }

    @Test public void anyInterleavingKeepsOneOperationInFlightAndConvergesOnTheLatestWish() {
        for (long seed = 1; seed <= 20; seed++) {
            Radio network = new Radio();
            ListingRegistration machine = new ListingRegistration(network);
            Random random = new Random(seed);
            boolean wish = true;
            machine.open();
            for (int step = 0; step < 400; step++) {
                if (network.pending != null && random.nextInt(3) == 0) {
                    String operation = network.pending;
                    network.pending = null;
                    if ("register".equals(operation)) { network.live = network.pendingListed; machine.registered(); }
                    else { network.live = null; machine.unregistered(); }
                } else {
                    wish = random.nextBoolean();
                    machine.setListed(wish);
                }
            }
            while (network.pending != null) {
                String operation = network.pending;
                network.pending = null;
                if ("register".equals(operation)) { network.live = network.pendingListed; machine.registered(); }
                else { network.live = null; machine.unregistered(); }
            }
            assertEquals("seed " + seed, Boolean.valueOf(wish), network.live);
        }
    }
}
