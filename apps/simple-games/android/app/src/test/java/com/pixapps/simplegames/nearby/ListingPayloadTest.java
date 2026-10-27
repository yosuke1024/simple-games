package com.pixapps.simplegames.nearby;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;
import java.io.ByteArrayOutputStream;

public final class ListingPayloadTest {
    @Test public void validatesWireBytesWithoutTrustingMetadataIdentity() {
        String text = "{\"v\":2,\"label\":\"P-810001\",\"roomName\":\"週末のゲーム🙂\",\"gameId\":\"yacht\",\"protocol\":7,\"available\":true}";
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
    @Test public void aHiddenOrFullRoomServesTheSuccessfulEmptyRead() {
        byte[] raw = ListingPayload.encode("{\"v\":2,\"available\":true}", 255);
        for (int links = 0; links < PeerLinks.CAPACITY; links++) {
            assertSame(raw, ListingPayload.served(raw, true, links));
            assertNull(ListingPayload.served(raw, false, links));
        }
        for (int links = PeerLinks.CAPACITY; links <= PeerLinks.CAPACITY + 2; links++) {
            assertNull(ListingPayload.served(raw, true, links));
            assertNull(ListingPayload.served(raw, false, links));
        }
        assertNull(ListingPayload.served(null, true, 0));
        assertNull(ListingPayload.served(null, false, 0));
        // Hidden is the same wire answer as a full room: success with zero bytes, never an offset error.
        assertArrayEquals(new byte[0], ListingPayload.read(ListingPayload.served(raw, false, 0), 0));
        assertArrayEquals(ListingPayload.read(ListingPayload.served(raw, true, PeerLinks.CAPACITY), 0),
            ListingPayload.read(ListingPayload.served(raw, false, 0), 0));
        assertThrows(IllegalArgumentException.class, () -> ListingPayload.read(ListingPayload.served(raw, false, 0), 1));
    }
    @Test public void aHiddenLanRecordLeavesTheTxtItemOutInsteadOfSettingItEmpty() {
        String text = "{\"v\":2,\"available\":true}";
        byte[] raw = ListingPayload.encode(text, ListingPayload.MAX_TXT_BYTES);
        assertEquals(text, ListingPayload.txtListing(raw, true));
        // null means "do not call setAttribute": an empty string would make Android browsers withdraw the peer.
        assertNull(ListingPayload.txtListing(raw, false));
        assertNull(ListingPayload.txtListing(null, true));
        assertNull(ListingPayload.txtListing(null, false));
        assertNull(ListingPayload.txtListing(new byte[0], true));
        assertNull(ListingPayload.txtListing(new byte[0], false));
        assertNull(ListingPayload.txtListing(new byte[] {(byte) 0xff}, true));
    }
    @Test public void carriesMaximumRoomNameThroughTxtAndDefaultMtuLongReads() {
        String roomName = "🦊".repeat(24);
        String text = "{\"v\":2,\"label\":\"P-8B0001\",\"roomName\":\"" + roomName + "\",\"gameId\":\"nested-tic-tac-toe\",\"protocol\":7,\"available\":true}";
        byte[] raw = ListingPayload.encode(text, ListingPayload.MAX_TXT_BYTES);
        assertTrue(raw.length + "listing=".length() <= 255);
        assertEquals(text, ListingPayload.decode(raw));
        ByteArrayOutputStream reconstructed = new ByteArrayOutputStream();
        while (reconstructed.size() < raw.length) {
            byte[] suffix = ListingPayload.read(raw, reconstructed.size());
            reconstructed.write(suffix, 0, Math.min(22, suffix.length));
        }
        assertEquals(text, ListingPayload.decode(reconstructed.toByteArray()));
    }
    @Test public void onlyNewGameLabelsAllowPassiveMetadataConnections() {
        for (int code = 0; code < 256; code++) {
            String label = "P-" + String.format("%02x", code) + "1234";
            assertEquals(code >= 0x81 && code <= 0x8e, DiscoveryLabel.metadataCapable(label));
        }
        assertFalse(DiscoveryLabel.metadataCapable(null));
        assertFalse(DiscoveryLabel.metadataCapable("P-81"));
        assertTrue(DiscoveryLabel.metadataCapable("F-8DFFFF"));
    }
}
