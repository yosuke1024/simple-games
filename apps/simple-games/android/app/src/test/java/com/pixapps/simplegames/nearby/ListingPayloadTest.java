package com.pixapps.simplegames.nearby;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;

public final class ListingPayloadTest {
    @Test public void validatesWireBytesWithoutTrustingMetadataIdentity() {
        String text = "{\"name\":\"日本語🙂\"}";
        byte[] raw = ListingPayload.encode(text, 255);
        assertEquals(text, ListingPayload.decode(raw));
        assertEquals(255, ListingPayload.encode("x".repeat(255), 255).length);
        assertEquals(247, ListingPayload.encode("x".repeat(247), ListingPayload.MAX_TXT_BYTES).length);
        for (String invalid : new String[] {"", "x".repeat(256), "\ud800"}) {
            assertThrows(IllegalArgumentException.class, () -> ListingPayload.encode(invalid, 255));
        }
        assertThrows(IllegalArgumentException.class, () -> ListingPayload.encode("x".repeat(248), ListingPayload.MAX_TXT_BYTES));
        assertThrows(IllegalArgumentException.class, () -> ListingPayload.encode("🙂".repeat(64), 255));
        assertNull(ListingPayload.decode(new byte[] {(byte) 0xc3, 0x28}));
        assertNull(ListingPayload.decode(new byte[256]));
        assertNull(ListingPayload.decode(new byte[0]));
        assertNull(ListingPayload.decode(null));
        assertNull(ListingPayload.encode(null, 255));
        for (int offset = 0; offset <= raw.length; offset++) {
            assertArrayEquals(Arrays.copyOfRange(raw, offset, raw.length), ListingPayload.read(raw, offset));
        }
        assertThrows(IllegalArgumentException.class, () -> ListingPayload.read(raw, raw.length + 1));
        assertThrows(IllegalArgumentException.class, () -> ListingPayload.read(raw, -1));
        assertArrayEquals(new byte[0], ListingPayload.read(null, 0));
    }
    @Test public void onlyNewGameLabelsAllowPassiveMetadataConnections() {
        for (int code = 0; code < 256; code++) {
            String label = "P-" + String.format("%02x", code) + "1234";
            assertEquals(code >= 0x81 && code <= 0x8d, DiscoveryLabel.metadataCapable(label));
        }
        assertFalse(DiscoveryLabel.metadataCapable(null));
        assertFalse(DiscoveryLabel.metadataCapable("P-81"));
        assertTrue(DiscoveryLabel.metadataCapable("F-8DFFFF"));
    }
}
