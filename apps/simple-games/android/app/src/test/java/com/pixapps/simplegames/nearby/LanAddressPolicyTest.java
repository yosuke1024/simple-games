package com.pixapps.simplegames.nearby;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public final class LanAddressPolicyTest {
    private static InetAddress ip(String value) throws Exception { return InetAddress.getByName(value); }
    private static LanAddressPolicy.Link link(String value, int prefix) throws Exception {
        return new LanAddressPolicy.Link(ip(value), prefix);
    }

    @Test public void ipv6OnlyLinksAreUsableAndLinkLocalGetsTheSelectedInterfaceScope() throws Exception {
        List<LanAddressPolicy.Link> links = Arrays.asList(link("2001:db8:1::5", 64), link("fe80::5", 64));
        List<InetAddress> local = LanAddressPolicy.localAddresses(links, 7);
        assertEquals(2, local.size());
        assertEquals(7, ((Inet6Address) local.get(1)).getScopeId());
        Inet6Address remote = (Inet6Address) LanAddressPolicy.allowedRemote(ip("fe80::6"), links, 7);
        assertNotNull(remote);
        assertEquals(7, remote.getScopeId());
        assertNotNull(LanAddressPolicy.allowedRemote(ip("2001:db8:1::6"), links, 7));
        assertNull(LanAddressPolicy.allowedRemote(ip("2001:db8:2::6"), links, 7));
        assertNull(LanAddressPolicy.allowedRemote(ip("192.168.1.6"), links, 7));
    }

    @Test public void anotherInterfacesLinkLocalAddressCannotBeReScopedIntoWifi() throws Exception {
        List<LanAddressPolicy.Link> links = Collections.singletonList(link("fe80::5", 64));
        Inet6Address wrong = Inet6Address.getByAddress(null, ip("fe80::6").getAddress(), 9);
        assertNull(LanAddressPolicy.allowedRemote(wrong, links, 7));
        assertNull(LanAddressPolicy.allowedRemote(ip("fe80::6"), links, 0));
        assertTrue(LanAddressPolicy.localAddresses(links, 0).isEmpty());
    }

    @Test public void ipv4AndIpv6CandidatesRemainOnTheirExactWifiPrefixes() throws Exception {
        List<LanAddressPolicy.Link> links = Arrays.asList(link("192.168.4.1", 24), link("fd12:3456:789a:1::1", 64));
        List<InetAddress> candidates = LanAddressPolicy.remoteAddresses(Arrays.asList(
            ip("fd12:3456:789a:1::7"), ip("203.0.113.7"), ip("192.168.4.7"), ip("192.168.4.7")), links, 7);
        assertEquals(Arrays.asList(ip("192.168.4.7"), ip("fd12:3456:789a:1::7")), candidates);
        for (String rejected : Arrays.asList("0.0.0.0", "127.0.0.1", "224.0.0.1", "::", "::1", "ff02::1",
            "192.168.5.1", "fd12:3456:789a:2::7", "fe80::7")) {
            assertNull(rejected, LanAddressPolicy.allowedRemote(ip(rejected), links, 7));
        }
    }

    @Test public void partialByteAndInvalidPrefixesDoNotExpandTheAllowedSubnet() throws Exception {
        List<LanAddressPolicy.Link> narrow = Collections.singletonList(link("192.168.4.129", 25));
        assertNotNull(LanAddressPolicy.allowedRemote(ip("192.168.4.200"), narrow, 7));
        assertNull(LanAddressPolicy.allowedRemote(ip("192.168.4.1"), narrow, 7));
        for (int prefix : Arrays.asList(-1, 0, 33)) {
            List<LanAddressPolicy.Link> invalid = Collections.singletonList(link("192.168.4.1", prefix));
            assertTrue(LanAddressPolicy.localAddresses(invalid, 7).isEmpty());
            assertNull(LanAddressPolicy.allowedRemote(ip("192.168.4.2"), invalid, 7));
        }
    }

    @Test public void ipv4OnlyAndLegacySingleResolvedHostRemainSupported() throws Exception {
        List<LanAddressPolicy.Link> links = Collections.singletonList(link("192.168.4.1", 24));
        assertEquals(Collections.singletonList(ip("192.168.4.1")), LanAddressPolicy.localAddresses(links, 7));
        assertEquals(Collections.singletonList(ip("192.168.4.2")), LanAddressPolicy.remoteAddresses(
            Collections.singletonList(ip("192.168.4.2")), links, 7));
        List<LanAddressPolicy.Link> ipv6 = Collections.singletonList(link("fd12:3456::1", 64));
        assertEquals(Collections.singletonList(ip("fd12:3456::2")), LanAddressPolicy.remoteAddresses(
            Collections.singletonList(ip("fd12:3456::2")), ipv6, 7));
    }

    @Test public void addressCountsAreBoundedAndLocalOverflowFailsInsteadOfAdvertisingUnboundAddresses() throws Exception {
        List<LanAddressPolicy.Link> local = new ArrayList<>();
        List<InetAddress> remote = new ArrayList<>();
        for (int i = 1; i <= 9; i++) {
            local.add(link("192.168.4." + i, 24));
            remote.add(ip("192.168.4." + (i + 20)));
        }
        assertThrows(IllegalArgumentException.class, () -> LanAddressPolicy.localAddresses(local, 7));
        assertEquals(8, LanAddressPolicy.remoteAddresses(remote, local, 7).size());
    }

    @Test public void changedAddressesOrPrefixesInvalidateTheOriginalNetworkSnapshot() throws Exception {
        List<LanAddressPolicy.Link> before = Arrays.asList(link("192.168.4.1", 24), link("fe80::1", 64));
        assertTrue(LanAddressPolicy.sameLinks(before, Arrays.asList(link("fe80::1", 64), link("192.168.4.1", 24))));
        assertFalse(LanAddressPolicy.sameLinks(before, Arrays.asList(link("192.168.5.1", 24), link("fe80::1", 64))));
        assertFalse(LanAddressPolicy.sameLinks(before, Arrays.asList(link("192.168.4.1", 16), link("fe80::1", 64))));
        assertFalse(LanAddressPolicy.sameLinks(before, Collections.singletonList(link("192.168.4.1", 24))));
    }
}
