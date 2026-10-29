package com.pixapps.simplegames.nearby;

import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

public final class DiscoveryLabelTest {
    @Test public void acceptsOnlyBoundedPublicMetadata() {
        for (String label : new String[] {"P-000000", "P-aBc123", "F-FFFFFF", "F-123456"}) {
            assertTrue(label, DiscoveryLabel.valid(label));
            assertEquals(label, DiscoveryLabel.fromBytes(label.getBytes(StandardCharsets.US_ASCII)));
            assertEquals(label, DiscoveryLabel.fromServiceName("NP-" + label));
            assertEquals(label, DiscoveryLabel.fromServiceName("NP-" + label + " (2)"));
            assertEquals(label, DiscoveryLabel.fromServiceName("NP-" + label + " (9999)"));
        }
        for (String invalid : new String[] {null, "", "P-12345", "P-1234567", "F-abcdefg", "X-123456",
                "p-123456", "P-12g456", "P-日本語", "P-12345\n", "F-12345\0", "P-123456 "}) {
            assertFalse(String.valueOf(invalid), DiscoveryLabel.valid(invalid));
            if (invalid != null) assertNull(DiscoveryLabel.fromBytes(invalid.getBytes(StandardCharsets.UTF_8)));
        }
        assertNull(DiscoveryLabel.fromBytes(null));
        assertNull(DiscoveryLabel.fromBytes(new byte[] {'P', '-', '1', '2', '3', '4', '5', (byte) 0xff}));
    }

    @Test public void ludoMetadataCanBeProbedWithoutEnablingUnknownGames() {
        assertTrue(DiscoveryLabel.metadataCapable("P-8E1234"));
        assertTrue(DiscoveryLabel.metadataCapable("P-8eabcd"));
        assertFalse(DiscoveryLabel.metadataCapable("P-0E1234"));
        assertFalse(DiscoveryLabel.metadataCapable("P-8F1234"));
    }

    @Test public void acceptsOnlyKnownBonjourCollisionSuffixes() {
        for (String invalid : new String[] {null, "", "NP-", "SG-P-123456", "P-123456", "NP-P-1234567",
                "NP-P-123456(2)", "NP-P-123456 (0)", "NP-P-123456 (02)", "NP-P-123456 (10000)",
                "NP-P-123456 (2) extra", "NP-P-123456.local.", "NP-P-123456\n", "NP-F-123456 ",
                "NP-P-123456 (2)(3)", "NP-F-123456 (2)\0"}) {
            assertNull(String.valueOf(invalid), DiscoveryLabel.fromServiceName(invalid));
        }
    }
}
