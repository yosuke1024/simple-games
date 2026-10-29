package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bounded physical links. IDs are fresh per connection and never expose radio addresses. */
final class PeerLinks<T> {
    static final int CAPACITY = 3;
    private final Map<String, T> links = new LinkedHashMap<>();
    synchronized String add(T link) {
        if (links.size() == CAPACITY || links.containsValue(link)) return null;
        String id = "link-" + UUID.randomUUID();
        links.put(id, link);
        return id;
    }
    synchronized T get(String id) { return links.get(id); }
    synchronized T remove(String id) { return links.remove(id); }
    synchronized List<T> values() { return new ArrayList<>(links.values()); }
    synchronized int size() { return links.size(); }
    synchronized void clear() { links.clear(); }
}
