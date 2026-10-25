package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** A bounded, ephemeral discovery cache; IDs never recycle within one scan. */
final class DiscoveryIndex<T> {
    static final int LIMIT = 16;
    static final long TTL_MS = 15_000;
    static final long PROBE_INTERVAL_MS = 10_000;
    static final class Peer<T> {
        final String id;
        final String key;
        T value;
        String label;
        String listing;
        boolean announced;
        long lastSeen;
        long verifiedAt;
        long lastProbe = -PROBE_INTERVAL_MS;
        Peer(String id, String key, T value, String label, long now) {
            this.id = id; this.key = key; this.value = value; this.label = label; this.lastSeen = now;
        }
    }
    private final String prefix;
    private int serial;
    private final Map<String, Peer<T>> peers = new LinkedHashMap<>();
    DiscoveryIndex(String prefix) { this.prefix = prefix; }
    Peer<T> byKey(String key) { return peers.get(key); }
    Peer<T> byId(String id) { for (Peer<T> peer : peers.values()) if (peer.id.equals(id)) return peer; return null; }
    Peer<T> seen(String key, T value, String label, long now) {
        Peer<T> peer = peers.get(key);
        if (peer == null) {
            if (peers.size() >= LIMIT) return null;
            peer = new Peer<>(prefix + (++serial), key, value, label, now); peers.put(key, peer);
        } else if (!peer.label.equals(label)) {
            peer.label = label; peer.listing = null; peer.announced = false; peer.lastProbe = -PROBE_INTERVAL_MS;
        }
        peer.value = value; peer.lastSeen = now; return peer;
    }
    boolean contains(Peer<T> peer) { return peer != null && peers.get(peer.key) == peer; }
    Peer<T> nextProbe(long now) {
        Peer<T> next = null;
        for (Peer<T> peer : peers.values()) if (now - peer.lastProbe >= PROBE_INTERVAL_MS &&
            (next == null || peer.lastProbe < next.lastProbe)) next = peer;
        if (next != null) next.lastProbe = now;
        return next;
    }
    Peer<T> remove(String key) { return peers.remove(key); }
    List<Peer<T>> expire(long now) {
        List<Peer<T>> lost = new ArrayList<>();
        peers.values().removeIf(peer -> { if (now - peer.lastSeen < TTL_MS) return false; lost.add(peer); return true; });
        return lost;
    }
    boolean publish(Peer<T> peer, String listing, long now) {
        if (!contains(peer)) return false;
        boolean changed = !peer.announced || !java.util.Objects.equals(peer.listing, listing);
        peer.announced = true; peer.listing = listing; peer.verifiedAt = now; return changed;
    }
    boolean withdraw(Peer<T> peer) {
        if (!contains(peer)) return false;
        boolean announced = peer.announced;
        peer.announced = false; peer.listing = null; return announced;
    }
    List<Peer<T>> expireListings(long now) {
        List<Peer<T>> stale = new ArrayList<>();
        for (Peer<T> peer : peers.values()) if (DiscoveryLabel.metadataCapable(peer.label) &&
            peer.announced && now - peer.verifiedAt >= TTL_MS) {
            withdraw(peer); stale.add(peer);
        }
        return stale;
    }
    List<Peer<T>> revalidate(long now) {
        List<Peer<T>> all = new ArrayList<>(peers.values());
        for (Peer<T> peer : all) { peer.listing = null; peer.announced = false; peer.lastSeen = now; peer.lastProbe = -PROBE_INTERVAL_MS; }
        return all;
    }
    List<Peer<T>> clear() { List<Peer<T>> lost = new ArrayList<>(peers.values()); peers.clear(); return lost; }
}
