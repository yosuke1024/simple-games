package com.pixapps.simplegames.nearby;

import java.util.ArrayDeque;

/** Main-thread FIFO. Never leave an unbounded queue in a paused WebView bridge. */
final class BackgroundEventBuffer<T> {
    static final int MAX_EVENTS = 64;
    static final int MAX_BYTES = 256 * 1024;
    private static final class Entry<T> {
        final T value;
        final int bytes;
        Entry(T value, int bytes) { this.value = value; this.bytes = bytes; }
    }
    private final ArrayDeque<Entry<T>> events = new ArrayDeque<>();
    private int bytes;

    boolean offer(T value, int size) {
        if (size < 0 || size > MAX_BYTES || events.size() >= MAX_EVENTS || size > MAX_BYTES - bytes) return false;
        events.addLast(new Entry<>(value, size));
        bytes += size;
        return true;
    }
    T poll() {
        Entry<T> entry = events.pollFirst();
        if (entry == null) return null;
        bytes -= entry.bytes;
        return entry.value;
    }
    int size() { return events.size(); }
    int bytes() { return bytes; }
    void clear() { events.clear(); bytes = 0; }
}
