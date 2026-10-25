package com.pixapps.simplegames.nearby;

import org.junit.Test;
import static org.junit.Assert.*;

public final class DiscoveryIndexTest {
    @Test public void boundsDeduplicatesAndExpiresCandidatesWithoutRecyclingIds() {
        DiscoveryIndex<String> index = new DiscoveryIndex<>("ble-");
        DiscoveryIndex.Peer<String> first = index.seen("a", "address", "P-811234", 0);
        assertSame(first, index.seen("a", "address", "P-811234", 10_000));
        for (int i = 1; i < 16; i++) assertNotNull(index.seen("b" + i, "addr" + i, "P-821234", 0));
        assertNull(index.seen("overflow", "address", "P-811234", 0));
        assertEquals(15, index.expire(15_000).size());
        assertSame(first, index.byId(first.id));
        DiscoveryIndex.Peer<String> replacement = index.seen("new", "address", "P-811234", 15_000);
        assertNotEquals(first.id, replacement.id);
        assertEquals(1, index.expire(25_000).size());
        assertFalse(index.contains(first));
        assertNull(index.byId(first.id));
    }
    @Test public void refreshIsFairAndListingsExpireDespiteFreshRadioAdvertisements() {
        DiscoveryIndex<String> index = new DiscoveryIndex<>("lan-");
        DiscoveryIndex.Peer<String> a = index.seen("a", "a", "P-811234", 0);
        DiscoveryIndex.Peer<String> b = index.seen("b", "b", "P-821234", 0);
        assertSame(a, index.nextProbe(0));
        assertSame(b, index.nextProbe(10_000)); // An older unprobed entry wins over a refresh.
        assertSame(a, index.nextProbe(10_000));
        assertNull(index.nextProbe(10_001));
        assertTrue(index.publish(a, "public metadata", 0));
        assertFalse(index.publish(a, "public metadata", 0));
        index.seen("a", "a", "P-811234", 14_999);
        assertEquals(1, index.expireListings(15_000).size());
        assertNull(a.listing);
        assertFalse(a.announced);
        assertTrue(index.publish(a, null, 15_000)); // Resume-only is usable only after a successful read.
        assertTrue(index.withdraw(a));
        assertFalse(index.withdraw(a));
        a.listing = "again";
        index.seen("a", "a", "P-831234", 15_000);
        assertNull(a.listing); // A new room on the same radio cannot inherit the old name.
        assertEquals(2, index.revalidate(60_000).size());
        assertEquals(0, index.expire(60_001).size());
        assertNotNull(index.nextProbe(60_001));
        assertEquals(2, index.clear().size());
        assertFalse(index.contains(a));
    }
}
