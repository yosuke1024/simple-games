package com.pixapps.simplegames.nearby;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Only concrete addresses on the selected Wi-Fi link, including scoped IPv6. */
final class LanAddressPolicy {
    static final int MAX_ADDRESSES = 8;
    static final class Link {
        final InetAddress address;
        final int prefix;
        Link(InetAddress address, int prefix) { this.address = address; this.prefix = prefix; }
    }

    private static boolean unicast(InetAddress address) {
        return address != null && (address instanceof Inet4Address || address instanceof Inet6Address) &&
            !address.isAnyLocalAddress() && !address.isLoopbackAddress() && !address.isMulticastAddress();
    }

    private static InetAddress scoped(InetAddress address, int interfaceIndex) {
        if (!unicast(address)) return null;
        if (!(address instanceof Inet6Address)) return address;
        Inet6Address ipv6 = (Inet6Address) address;
        if (ipv6.getScopeId() != 0 && ipv6.getScopeId() != interfaceIndex) return null;
        if (!ipv6.isLinkLocalAddress()) return ipv6;
        if (interfaceIndex <= 0) return null;
        try { return Inet6Address.getByAddress(null, ipv6.getAddress(), interfaceIndex); }
        catch (UnknownHostException impossible) { return null; }
    }

    static List<InetAddress> localAddresses(List<Link> links, int interfaceIndex) {
        List<InetAddress> result = new ArrayList<>();
        for (Link link : links) {
            InetAddress address = scoped(link.address, interfaceIndex);
            if (address == null || link.prefix <= 0 || link.prefix > address.getAddress().length * 8) continue;
            if (!result.contains(address)) result.add(address);
            // Advertising addresses without corresponding listeners would create unreachable peers.
            if (result.size() > MAX_ADDRESSES) throw new IllegalArgumentException("Too many Wi-Fi addresses");
        }
        return result;
    }

    static InetAddress allowedRemote(InetAddress address, List<Link> links, int interfaceIndex) {
        InetAddress scoped = scoped(address, interfaceIndex);
        if (scoped == null) return null;
        byte[] remote = scoped.getAddress();
        for (Link link : links) {
            InetAddress localAddress = scoped(link.address, interfaceIndex);
            if (localAddress == null) continue;
            byte[] local = localAddress.getAddress();
            if (local.length != remote.length || link.prefix <= 0 || link.prefix > local.length * 8) continue;
            // Never route an IPv6 link-local candidate through a global-address prefix or vice versa.
            if (localAddress.isLinkLocalAddress() != scoped.isLinkLocalAddress()) continue;
            boolean same = true;
            int prefix = link.prefix;
            for (int i = 0; i < local.length && prefix > 0; i++, prefix -= 8) {
                int mask = 0xff << (8 - Math.min(prefix, 8));
                if ((local[i] & mask) != (remote[i] & mask)) { same = false; break; }
            }
            if (same) return scoped;
        }
        return null;
    }

    static List<InetAddress> remoteAddresses(List<InetAddress> resolved, List<Link> links, int interfaceIndex) {
        List<InetAddress> result = new ArrayList<>();
        int examined = 0;
        for (InetAddress candidate : resolved) {
            if (++examined > MAX_ADDRESSES * 4) break;
            InetAddress allowed = allowedRemote(candidate, links, interfaceIndex);
            if (allowed != null && !result.contains(allowed)) result.add(allowed);
            if (result.size() == MAX_ADDRESSES) break;
        }
        // Preserve the working IPv4 path on mixed LANs; IPv6-only still has its full candidate list.
        result.sort((left, right) -> Boolean.compare(left instanceof Inet6Address, right instanceof Inet6Address));
        return result;
    }

    static boolean sameLinks(List<Link> before, List<Link> after) {
        if (before.size() != after.size()) return false;
        for (Link one : before) {
            boolean found = false;
            for (Link two : after) {
                if (one.prefix == two.prefix && Arrays.equals(one.address.getAddress(), two.address.getAddress())) {
                    found = true; break;
                }
            }
            if (!found) return false;
        }
        return true;
    }
}
