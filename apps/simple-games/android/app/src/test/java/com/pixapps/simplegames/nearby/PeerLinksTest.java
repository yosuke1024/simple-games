package com.pixapps.simplegames.nearby;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public final class PeerLinksTest {
    @Test public void threeGuestsAreBoundedAndDisconnectOnlyReleasesTheirSeat() {
        PeerLinks<Object> peers = new PeerLinks<>();
        Object a = new Object(), b = new Object(), c = new Object(), d = new Object();
        String first = peers.add(a), second = peers.add(b), third = peers.add(c);
        assertNotNull(first); assertNotNull(second); assertNotNull(third);
        assertNull(peers.add(d)); assertNull(peers.add(a));
        assertSame(b, peers.remove(second));
        assertSame(a, peers.get(first)); assertSame(c, peers.get(third));
        String next = peers.add(d);
        assertNotNull(next); assertNotEquals(second, next);
        assertNull(peers.remove(second)); assertSame(d, peers.get(next));
        peers.clear(); assertEquals(0, peers.size());
    }

    @Test public void interleavedPeerFragmentsCannotShareDecoderState() throws Exception {
        PeerLinks<FrameCodec> peers = new PeerLinks<>();
        FrameCodec first = new FrameCodec(), second = new FrameCodec();
        String a = peers.add(first), b = peers.add(second);
        List<String> aFrames = new ArrayList<>(), bFrames = new ArrayList<>();
        byte[] aBytes = FrameCodec.encode("{\"seat\":1}"), bBytes = FrameCodec.encode("{\"seat\":2}");
        peers.get(a).accept(aBytes, 3, aFrames::add);
        peers.get(b).accept(bBytes, bBytes.length, bFrames::add);
        assertTrue(aFrames.isEmpty()); assertEquals("{\"seat\":2}", bFrames.get(0));
        byte[] tail = java.util.Arrays.copyOfRange(aBytes, 3, aBytes.length);
        peers.get(a).accept(tail, tail.length, aFrames::add);
        assertEquals("{\"seat\":1}", aFrames.get(0));
    }
}
