package com.pixapps.simplegames.nearby;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public final class MultiPeerTransportTest {
    private static final class Recorded implements Transport.Events {
        final List<String> received = new ArrayList<>();
        public void peer(String id, String name, String listing) { received.add("peer:" + id); }
        public void peerLost(String id) {}
        public void connected() { fail("Multi-peer connection must have a peerId"); }
        public void connected(String id) { received.add("connected:" + id); }
        public void data(String data) { fail("Multi-peer data must have a peerId"); }
        public void data(String id, String data) { received.add("data:" + id + ":" + data); }
        public void status(String message) {}
        public void failed(String code, String message) { received.add("failed:" + code); }
        public void disconnected(String reason) { fail("Peer disconnection must have a peerId"); }
        public void disconnected(String id, String reason) { received.add("disconnected:" + id); }
    }
    private static final class Fake implements Transport {
        Events events;
        boolean stopped;
        String sentTo;
        String disconnected;
        boolean rejectConnect;
        public void start(boolean advertise, String label, byte[] listing) {}
        public void connect(String id) { if (rejectConnect) throw new IllegalArgumentException("unknown peer"); }
        public void send(byte[] data) { sentTo = "guest-host"; }
        public void send(byte[] data, String id) { sentTo = id; }
        public void disconnect(String id) { disconnected = id; }
        public void setForeground(boolean foreground) {}
        public void stop() { stopped = true; }
    }
    private MultiPeerTransport create(Recorded events, Fake fake) {
        return new MultiPeerTransport(events, (hosting, callbacks) -> { fake.events = callbacks; return fake; });
    }
    @Test public void guestEventsAndFailuresBelongToSelectedHostOnly() throws Exception {
        Recorded events = new Recorded(); Fake fake = new Fake();
        MultiPeerTransport multi = create(events, fake);
        multi.start(false, "P-8E1234", null); multi.connect("browse-4");
        fake.events.connected(); fake.events.data("hello");
        multi.send(FrameCodec.encode("message"), "browse-4");
        assertEquals("guest-host", fake.sentTo);
        try { multi.send(FrameCodec.encode("message"), "another-host"); fail(); }
        catch (IllegalStateException expected) {}
        fake.events.failed("connection-lost", "closed");
        assertTrue(fake.stopped);
        assertEquals(java.util.Arrays.asList("connected:browse-4", "data:browse-4:hello", "disconnected:browse-4"), events.received);
        fake.events.data("late"); assertEquals(3, events.received.size());
    }
    @Test public void hostCannotBroadcastAccidentallyAndDisconnectIsTargeted() throws Exception {
        Recorded events = new Recorded(); Fake fake = new Fake();
        MultiPeerTransport multi = create(events, fake);
        multi.start(true, "P-8E1234", null);
        try { multi.send(FrameCodec.encode("message")); fail(); }
        catch (IllegalArgumentException expected) {}
        try { multi.send(FrameCodec.encode("message"), null); fail(); }
        catch (IllegalArgumentException expected) {}
        multi.send(FrameCodec.encode("message"), "link-2"); assertEquals("link-2", fake.sentTo);
        multi.disconnect("link-2"); assertEquals("link-2", fake.disconnected); assertFalse(fake.stopped);
        multi.stop(); assertTrue(fake.stopped);
    }
    @Test public void rejectedSelectionDoesNotReserveGuestHost() throws Exception {
        Recorded events = new Recorded(); Fake fake = new Fake();
        MultiPeerTransport multi = create(events, fake);
        multi.start(false, "P-8E1234", null); fake.rejectConnect = true;
        try { multi.connect("stale"); fail(); } catch (IllegalArgumentException expected) {}
        fake.rejectConnect = false; multi.connect("fresh"); fake.events.connected();
        assertEquals("connected:fresh", events.received.get(0));
    }
}
