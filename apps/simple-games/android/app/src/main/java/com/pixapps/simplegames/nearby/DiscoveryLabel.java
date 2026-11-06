package com.pixapps.simplegames.nearby;

import java.nio.charset.StandardCharsets;

/** Public discovery metadata, never an invitation secret or an identity credential. */
final class DiscoveryLabel {
    private DiscoveryLabel() {}

    static boolean valid(String label) {
        return label != null && label.length() == 8 && label.matches("[PF]-[0-9A-Fa-f]{6}");
    }

    static boolean metadataCapable(String label) {
        if (!valid(label)) return false;
        int code = Integer.parseInt(label.substring(2, 4), 16);
        // 0x80 | the highest code in src/app/nearbyGameIds.ts (Indian Rummy, 0x1C).
        // A game added there must raise this bound and iOS supportsProbe, or its
        // host is refused at start (src/test/nearbyNativeLabelRange.test.ts).
        return code >= 0x81 && code <= 0x9c;
    }

    static String fromBytes(byte[] bytes) {
        if (bytes == null || bytes.length != 8) return null;
        String label = new String(bytes, StandardCharsets.US_ASCII);
        return valid(label) ? label : null;
    }

    static String fromServiceName(String name) {
        if (name == null || name.length() > 18 || !name.startsWith("NP-")) return null;
        String label = name.length() >= 11 ? name.substring(3, 11) : null;
        if (!valid(label)) return null;
        String suffix = name.substring(11);
        // Bonjour may append a collision counter; do not accept arbitrary trailing metadata.
        return suffix.isEmpty() || suffix.matches(" \\([1-9][0-9]{0,3}\\)") ? label : null;
    }
}
