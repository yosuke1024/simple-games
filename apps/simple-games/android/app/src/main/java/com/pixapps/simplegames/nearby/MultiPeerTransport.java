package com.pixapps.simplegames.nearby;

import android.content.Context;

/** Three independent host links; browsers retain the established discovery/client implementation. */
final class MultiPeerTransport implements Transport {
    interface Factory { Transport create(boolean hosting, Events events); }
    private final Factory factory;
    private final Events events;
    private Transport delegate;
    private String selected;
    private boolean hosting;
    private boolean ready;

    MultiPeerTransport(Context context, Events events, String kind) {
        this(events, (hosting, callbacks) -> hosting
            ? ("ble".equals(kind) ? new MultiBleHost(context, callbacks) : new LanTransport(context, callbacks, true))
            : ("ble".equals(kind) ? new BleTransport(context, callbacks) : new LanTransport(context, callbacks)));
    }
    MultiPeerTransport(Events events, Factory factory) {
        this.events = events; this.factory = factory;
    }
    public void start(boolean advertise, String label, byte[] listing) throws Exception {
        hosting = advertise;
        if (hosting) {
            delegate = factory.create(true, events);
        } else {
            Events guest = new Events() {
                public void peer(String id, String label, String metadata) { events.peer(id, label, metadata); }
                public void peerLost(String id) { events.peerLost(id); }
                public void connected() { ready = true; events.connected(selected); }
                public void data(String data) { if (ready) events.data(selected, data); }
                public void status(String message) { events.status(message); }
                public void disconnected(String reason) { lost(reason); }
                public void failed(String code, String message) {
                    if (selected != null) lost(message); else events.failed(code, message);
                }
            };
            delegate = factory.create(false, guest);
        }
        delegate.start(advertise, label, listing);
    }
    public void connect(String peerId) throws Exception {
        if (hosting || selected != null) throw new IllegalStateException("A host cannot connect and a guest has only one host");
        if (peerId == null) throw new IllegalArgumentException("peerId is required");
        selected = peerId;
        try { delegate.connect(peerId); }
        catch (Exception error) { selected = null; throw error; }
    }
    public void send(byte[] frame) { throw new IllegalArgumentException("peerId is required"); }
    public void send(byte[] frame, String peerId) throws Exception {
        if (peerId == null) throw new IllegalArgumentException("peerId is required");
        if (hosting) delegate.send(frame, peerId);
        else {
            if (!ready || !peerId.equals(selected)) throw new IllegalStateException("Selected host is not connected");
            delegate.send(frame);
        }
    }
    public void disconnect(String peerId) throws Exception {
        if (peerId == null) throw new IllegalArgumentException("peerId is required");
        if (hosting) delegate.disconnect(peerId);
        else if (peerId.equals(selected)) {
            ready = false;
            delegate.drainAndStop(() -> lost("disconnected"));
        }
    }
    private void lost(String reason) {
        String id = selected;
        selected = null; ready = false;
        if (delegate != null) delegate.stop();
        if (id != null) events.disconnected(id, reason);
    }
    public void setForeground(boolean foreground) { if (delegate != null) delegate.setForeground(foreground); }
    public void stop() {
        selected = null; ready = false;
        if (delegate != null) delegate.stop();
    }
}
