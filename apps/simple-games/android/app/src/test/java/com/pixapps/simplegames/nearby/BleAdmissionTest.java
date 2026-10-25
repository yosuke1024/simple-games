package com.pixapps.simplegames.nearby;

import org.junit.Test;
import static org.junit.Assert.*;

public final class BleAdmissionTest {
    @Test public void probesNeverOccupyOrEndTheGameSeat() {
        BleAdmission<String> state = new BleAdmission<>();
        assertTrue(state.connected("probe"));
        assertTrue(state.candidate("probe"));
        assertFalse(state.disconnected("probe"));
        assertFalse(state.subscribe("not-connected"));
        assertTrue(state.connected("probe2"));
        assertTrue(state.connected("player"));
        assertTrue(state.subscribe("player"));
        assertFalse(state.disconnected("probe2"));
        assertFalse(state.connected("intruder"));
        assertFalse(state.subscribe("intruder"));
        assertTrue(state.subscribe("player"));
        assertTrue(state.disconnected("player"));
        state.clear();
        assertTrue(state.connected("new-session"));
    }
    @Test public void idleReadersAreBoundedAndCanBeReleasedIndividually() {
        BleAdmission<Integer> state = new BleAdmission<>();
        for (int i = 0; i < 4; i++) assertTrue(state.connected(i));
        assertFalse(state.connected(4));
        assertTrue(state.connected(0));
        assertEquals(4, state.waiting().size());
        assertFalse(state.disconnected(1));
        assertTrue(state.connected(4));
        assertTrue(state.subscribe(4));
        assertEquals(3, state.waiting().size());
        for (Integer probe : state.waiting()) assertFalse(state.disconnected(probe));
        assertEquals(0, state.waiting().size());
    }
}
