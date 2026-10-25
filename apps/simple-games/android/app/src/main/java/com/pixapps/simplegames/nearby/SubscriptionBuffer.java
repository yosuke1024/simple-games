package com.pixapps.simplegames.nearby;

import java.util.Arrays;

/** Holds at most one early frame while the local CCC-write acknowledgement is pending. */
final class SubscriptionBuffer {
    private final byte[] bytes = new byte[FrameCodec.MAX_BYTES + 1];
    private int length;
    private boolean waiting;
    private boolean complete;

    void begin() { clear(); waiting = true; }

    void append(byte[] fragment) {
        if (!waiting || fragment == null || fragment.length == 0 || fragment.length > 20) {
            throw new IllegalStateException("Notification outside BLE subscription setup");
        }
        for (byte value : fragment) {
            if (complete || length == bytes.length || (length == FrameCodec.MAX_BYTES && value != '\n')) {
                throw new IllegalStateException("Early BLE notifications exceed one 4096-byte frame");
            }
            bytes[length++] = value;
            if (value == '\n') complete = true;
        }
    }

    byte[] finish() {
        byte[] result = Arrays.copyOf(bytes, length);
        clear();
        return result;
    }

    void clear() { Arrays.fill(bytes, (byte) 0); length = 0; complete = false; waiting = false; }
}
