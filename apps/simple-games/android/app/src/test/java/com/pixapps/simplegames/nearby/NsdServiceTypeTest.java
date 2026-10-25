package com.pixapps.simplegames.nearby;

public final class NsdServiceTypeTest {
    private static int assertions;

    private static void check(String input, String expected) {
        assertions++;
        String actual = NsdServiceType.normalize(input);
        if (!expected.equals(actual)) {
            throw new AssertionError("Input " + input + " normalized to " + actual + ", expected " + expected);
        }
    }

    @org.junit.Test
    public void validatesContract() {
        // The leading-dot resolve form caused Android browsing to reject the iOS
        // advertiser while Android advertising still worked in the reverse role.
        for (String leading : new String[] {"", "."}) {
            for (String suffix : new String[] {"", ".", ".local", ".local."}) {
                String form = leading + "_sgnearplay._tcp" + suffix;
                check(form, NsdServiceType.NEARBY);
                check(form.replace("_sgnearplay", "_other"), "");
                check(form.replace("_tcp", "_udp"), "");
            }
        }
        for (String invalid : new String[] {
            null, "", ".", "..", "local.",
            ".._sgnearplay._tcp", ".._sgnearplay._tcp.", ".._sgnearplay._tcp.local.",
            "_sgnearplay.._tcp", "._sgnearplay.._tcp", "_sgnearplay._tcp..", "._sgnearplay._tcp..",
            "_sgnearplay._tcp..local.", "_sgnearplay._tcp.local..", "_sgnearplay._tcp.local.local.",
            "_sgnearplay._tcp.example.", "_sgnearplay._tcp.local.example.", "_sgnearplay._tcp.local.extra",
            "prefix_sgnearplay._tcp", "_sgnearplay-extra._tcp", "_sgnearplay._tcp-extra", "_sgnearplay._tcp/",
            " _sgnearplay._tcp", "_sgnearplay._tcp ", "_sgnearplay._tcp\n", "_sgnearplay._tcp\u0000",
            "_sgnearplay", "_tcp", "_sgnearplay._udp", "_other._tcp"
        }) {
            check(invalid, "");
        }
        System.out.println("NsdServiceType: " + assertions + " checks passed");
    }
}
