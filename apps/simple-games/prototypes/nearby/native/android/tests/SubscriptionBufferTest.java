package com.pixapps.nearbypoc;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class SubscriptionBufferTest {
    private static int assertions;
    private static void check(boolean condition) {
        assertions++;
        if (!condition) throw new AssertionError("Check " + assertions + " failed");
    }
    private static void rejects(Runnable action) {
        assertions++;
        try { action.run(); } catch (IllegalStateException expected) { return; }
        throw new AssertionError("Check " + assertions + " should reject");
    }
    public static void main(String[] args) throws Exception {
        byte[] hello = FrameCodec.encode("{\"type\":\"hello\",\"name\":\"日本語🙂\"}");
        for (int split = 1; split <= hello.length; split++) {
            SubscriptionBuffer pending = new SubscriptionBuffer();
            pending.begin();
            for (int offset = 0; offset < split; offset += 20) {
                pending.append(Arrays.copyOfRange(hello, offset, Math.min(offset + 20, split)));
            }
            List<String> events = new ArrayList<>();
            FrameCodec decoder = new FrameCodec();
            events.add("connected");
            byte[] early = pending.finish();
            decoder.accept(early, early.length, events::add);
            byte[] remainder = Arrays.copyOfRange(hello, split, hello.length);
            decoder.accept(remainder, remainder.length, events::add);
            check(events.equals(List.of("connected", new String(hello, 0, hello.length - 1, StandardCharsets.UTF_8))));
            check(pending.finish().length == 0);
            rejects(() -> pending.append(new byte[] {'x'})); // No buffering after local readiness.
        }
        SubscriptionBuffer pending = new SubscriptionBuffer();
        rejects(() -> pending.append(new byte[] {'x'})); // No buffering before CCC setup.
        pending.begin();
        pending.append(new byte[] {'{', '}', '\n'});
        rejects(() -> pending.append(new byte[] {'{'})); // Only one early frame.
        pending.clear();
        check(pending.finish().length == 0); // Stop drops pending data.
        pending.begin();
        byte[] maximum = FrameCodec.encode("\"" + "x".repeat(4094) + "\"");
        for (int offset = 0; offset < maximum.length; offset += 20) {
            pending.append(Arrays.copyOfRange(maximum, offset, Math.min(offset + 20, maximum.length)));
        }
        check(Arrays.equals(pending.finish(), maximum));
        pending.begin();
        byte[] twenty = new byte[20]; Arrays.fill(twenty, (byte) 'x');
        for (int i = 0; i < 204; i++) pending.append(twenty);
        pending.append(Arrays.copyOf(twenty, 16));
        rejects(() -> pending.append(new byte[] {'x'}));
        pending.clear(); pending.begin();
        rejects(() -> pending.append(new byte[21]));
        rejects(() -> pending.append(new byte[0]));
        rejects(() -> pending.append(null));
        System.out.println("SubscriptionBuffer: " + assertions + " checks passed");
    }
}
