package com.pixapps.simplegames.nearby;

/**
 * Keeps one DNS-SD registration of a multi-seat host in step with "should this room be listed".
 * NsdManager cannot change a registered TXT record in place, so a change is an unregister followed
 * by a register of the same service name and port. At most one of the two is ever in flight, and any
 * number of requests made meanwhile collapse into the latest one. Main thread only.
 */
final class ListingRegistration {
    interface Driver {
        /** Start registering the service; the TXT listing item is present only when {@code listed}. */
        void register(boolean listed);
        /** Withdraw the registration the last {@link #register} call started. */
        void unregister();
    }

    private enum State { IDLE, REGISTERING, REGISTERED, UNREGISTERING, STOPPED }

    private final Driver driver;
    private State state = State.IDLE;
    private boolean desired = true;
    // The listing state of the registration that is in flight or live.
    private boolean listed = true;

    ListingRegistration(Driver driver) { this.driver = driver; }

    /** The first registration. It uses whatever {@link #setListed} recorded before the radio was ready. */
    void open() {
        if (state == State.IDLE) register();
    }

    /** A request before the first registration, or while one is in flight, only records the wish. */
    void setListed(boolean visible) {
        desired = visible;
        if (state == State.REGISTERED) reconcile();
    }

    /** The driver's registration completed. */
    void registered() {
        if (state != State.REGISTERING) return;
        state = State.REGISTERED;
        reconcile();
    }

    /** The driver's unregistration completed; register again with the latest wish. */
    void unregistered() {
        if (state == State.UNREGISTERING) register();
    }

    /** Nothing registers afterwards. A live or pending registration is withdrawn once. */
    void stop() {
        State previous = state;
        state = State.STOPPED;
        if (previous == State.REGISTERING || previous == State.REGISTERED) {
            try { driver.unregister(); } catch (RuntimeException ignored) { /* Stopping must not throw. */ }
        }
    }

    private void register() {
        listed = desired;
        state = State.REGISTERING;
        driver.register(listed);
    }

    private void reconcile() {
        if (desired == listed) return;
        state = State.UNREGISTERING;
        try {
            driver.unregister();
        } catch (RuntimeException error) {
            // Nothing was withdrawn, so no callback is coming: stay live and let the next request retry.
            state = State.REGISTERED;
            throw error;
        }
    }
}
