package com.pixapps.simplegames.nearby;

/** Normalizes only the product DNS-SD type, including Android's resolved leading dot. */
final class NsdServiceType {
    static final String NEARBY = "_sgnearplay._tcp.";
    private static final String BASE = "_sgnearplay._tcp";

    private NsdServiceType() {}

    static String normalize(String type) {
        if (type == null) return "";
        // Android discovery uses a trailing dot; resolveService historically uses
        // a leading dot. Remove at most one of each, never arbitrary empty labels.
        String result = type.startsWith(".") ? type.substring(1) : type;
        if (result.endsWith(".")) result = result.substring(0, result.length() - 1);
        if (result.endsWith(".local")) result = result.substring(0, result.length() - ".local".length());
        return BASE.equals(result) ? NEARBY : "";
    }
}
