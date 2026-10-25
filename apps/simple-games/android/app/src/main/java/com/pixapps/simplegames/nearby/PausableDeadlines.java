package com.pixapps.simplegames.nearby;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/** Suspend inactivity deadlines; resume grants a fresh bounded native progress window. */
final class PausableDeadlines {
    interface Scheduler {
        void post(Runnable callback, long delay);
        void remove(Runnable callback);
    }
    private final class Entry {
        final Runnable task;
        final Runnable callback;
        final long delay;
        Entry(Runnable task, long delay) {
            this.task = task;
            this.delay = delay;
            this.callback = () -> {
                if (paused || entries.get(task) != this) return;
                entries.remove(task);
                task.run();
            };
        }
    }
    private final Scheduler scheduler;
    private final Map<Runnable, Entry> entries = new LinkedHashMap<>();
    private boolean paused;
    PausableDeadlines(Scheduler scheduler) { this.scheduler = scheduler; }

    void post(Runnable task, long delay) {
        remove(task);
        Entry entry = new Entry(task, Math.max(0, delay));
        entries.put(task, entry);
        if (!paused) schedule(entry);
    }
    void remove(Runnable task) {
        Entry previous = entries.remove(task);
        if (previous != null) scheduler.remove(previous.callback);
    }
    void setActive(boolean active) {
        if (paused == !active) return;
        paused = !active;
        for (Entry entry : new ArrayList<>(entries.values())) {
            if (paused) {
                scheduler.remove(entry.callback);
            } else schedule(entry);
        }
    }
    void clear() {
        for (Entry entry : entries.values()) scheduler.remove(entry.callback);
        entries.clear();
    }
    private void schedule(Entry entry) {
        scheduler.post(entry.callback, entry.delay);
    }
}
