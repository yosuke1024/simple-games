package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Connecting or reading metadata never claims the single game seat. Only CCC does. */
final class BleAdmission<T> {
    private final Set<T> candidates = new LinkedHashSet<>();
    private T selected;
    boolean connected(T device) {
        if (selected != null) return selected.equals(device);
        if (candidates.contains(device)) return true;
        return candidates.size() < 4 && candidates.add(device);
    }
    boolean candidate(T device) { return candidates.contains(device); }
    boolean subscribe(T device) {
        if (selected != null) return selected.equals(device);
        if (!candidates.remove(device)) return false;
        selected = device; return true;
    }
    boolean disconnected(T device) {
        candidates.remove(device);
        return selected != null && selected.equals(device);
    }
    List<T> waiting() { return new ArrayList<>(candidates); }
    void clear() { candidates.clear(); selected = null; }
}
