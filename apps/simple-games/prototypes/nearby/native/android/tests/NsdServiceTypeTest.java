package com.pixapps.nearbypoc;

public final class NsdServiceTypeTest {
    private static int assertions;

    private static void check(String input, String expected) {
        assertions++;
        String actual = NsdServiceType.normalize(input);
        if (!expected.equals(actual)) {
            throw new AssertionError("Input " + input + " normalized to " + actual + ", expected " + expected);
        }
    }

    public static void main(String[] args) {
        // The leading-dot resolve form caused Android browsing to reject the iOS
        // advertiser while Android advertising still worked in the reverse role.
        for (String leading : new String[] {"", "."}) {
            for (String suffix : new String[] {"", ".", ".local", ".local."}) {
                String form = leading + "_sgnearby._tcp" + suffix;
                check(form, NsdServiceType.NEARBY);
                check(form.replace("_sgnearby", "_other"), "");
                check(form.replace("_tcp", "_udp"), "");
            }
        }
        for (String invalid : new String[] {
            null, "", ".", "..", "local.",
            ".._sgnearby._tcp", ".._sgnearby._tcp.", ".._sgnearby._tcp.local.",
            "_sgnearby.._tcp", "._sgnearby.._tcp", "_sgnearby._tcp..", "._sgnearby._tcp..",
            "_sgnearby._tcp..local.", "_sgnearby._tcp.local..", "_sgnearby._tcp.local.local.",
            "_sgnearby._tcp.example.", "_sgnearby._tcp.local.example.", "_sgnearby._tcp.local.extra",
            "prefix_sgnearby._tcp", "_sgnearby-extra._tcp", "_sgnearby._tcp-extra", "_sgnearby._tcp/",
            " _sgnearby._tcp", "_sgnearby._tcp ", "_sgnearby._tcp\n", "_sgnearby._tcp\u0000",
            "_sgnearby", "_tcp", "_sgnearby._udp", "_other._tcp"
        }) {
            check(invalid, "");
        }
        System.out.println("NsdServiceType: " + assertions + " checks passed");
    }
}
