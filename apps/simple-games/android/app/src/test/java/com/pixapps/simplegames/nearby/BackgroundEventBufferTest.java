package com.pixapps.simplegames.nearby;

import org.junit.Test;
import static org.junit.Assert.*;

public final class BackgroundEventBufferTest {
    @Test public void replaysAcknowledgementBeforeDisconnectWithoutReordering() {
        BackgroundEventBuffer<String> buffer = new BackgroundEventBuffer<>();
        assertTrue(buffer.offer("state-ack", 30));
        assertTrue(buffer.offer("data", 4096));
        assertTrue(buffer.offer("disconnected", 40));
        assertEquals("state-ack", buffer.poll());
        assertEquals("data", buffer.poll());
        assertEquals("disconnected", buffer.poll());
        assertNull(buffer.poll());
        assertEquals(0, buffer.bytes());
    }

    @Test public void boundsEventCountEvenForTinyEventsAndAllowsExplicitReset() {
        BackgroundEventBuffer<Integer> buffer = new BackgroundEventBuffer<>();
        for (int index = 0; index < 64; index++) assertTrue(buffer.offer(index, 1));
        assertFalse(buffer.offer(64, 1));
        assertEquals(64, buffer.size());
        assertEquals(Integer.valueOf(0), buffer.poll());
        assertTrue(buffer.offer(64, 1));
        buffer.clear();
        assertEquals(0, buffer.size());
        assertEquals(0, buffer.bytes());
        assertTrue(buffer.offer(65, 1));
        assertEquals(Integer.valueOf(65), buffer.poll());
    }

    @Test public void boundsBytesWithoutDroppingPreviouslyAcceptedEvents() {
        BackgroundEventBuffer<String> buffer = new BackgroundEventBuffer<>();
        assertTrue(buffer.offer("first", 200_000));
        assertFalse(buffer.offer("overflow", 100_000));
        assertFalse(buffer.offer("overflow", Integer.MAX_VALUE));
        assertFalse(buffer.offer("invalid", -1));
        assertEquals(200_000, buffer.bytes());
        assertEquals("first", buffer.poll());
        assertTrue(buffer.offer("exact-boundary", 256 * 1024));
        assertFalse(buffer.offer("overflow", 1));
        assertEquals("exact-boundary", buffer.poll());
    }
}
