package com.pixapps.simplegames.nearby;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Pure wire-boundary regression tests; no Android device required. */
public final class FrameCodecTest {
    private static int assertions;
    interface Checked { void run() throws Exception; }
    private static void check(boolean condition) {
        assertions++;
        if (!condition) throw new AssertionError("Check " + assertions + " failed");
    }
    private static void rejects(Checked action) throws Exception {
        assertions++;
        try { action.run(); } catch (Exception expected) { return; }
        throw new AssertionError("Check " + assertions + " should reject");
    }

    @org.junit.Test
    public void validatesContract() throws Exception {
        String unicode = "{\"name\":\"日本語🙂\",\"line\":\"escaped\\nnewline\"}";
        byte[] frame = FrameCodec.encode(unicode);
        // Every possible split includes splits inside each multibyte UTF-8 code point.
        for (int split = 1; split < frame.length; split++) {
            FrameCodec decoder = new FrameCodec();
            List<String> received = new ArrayList<>();
            decoder.accept(Arrays.copyOfRange(frame, 0, split), split, received::add);
            check(decoder.hasPartialFrame());
            decoder.accept(Arrays.copyOfRange(frame, split, frame.length), frame.length - split, received::add);
            check(received.equals(List.of(unicode)));
            check(!decoder.hasPartialFrame());
        }
        FrameCodec decoder = new FrameCodec();
        List<String> received = new ArrayList<>();
        byte[] joined = "{}\n[1,true,null]\n\"ok\"\n".getBytes(StandardCharsets.UTF_8);
        decoder.accept(joined, joined.length, received::add);
        check(received.equals(List.of("{}", "[1,true,null]", "\"ok\"")));

        String max = "\"" + "x".repeat(4094) + "\"";
        byte[] maximum = FrameCodec.encode(max);
        check(maximum.length == 4097);
        received.clear();
        decoder.accept(maximum, maximum.length, received::add);
        check(received.equals(List.of(max)));
        rejects(() -> FrameCodec.encode("\"" + "x".repeat(4095) + "\""));
        rejects(() -> FrameCodec.encode("\"" + "あ".repeat(1365) + "\""));
        rejects(() -> FrameCodec.encode("{\n}"));
        rejects(() -> FrameCodec.encode(""));
        rejects(() -> FrameCodec.encode(null));
        rejects(() -> FrameCodec.encode("\"\ud800\""));
        rejects(() -> new FrameCodec().accept(new byte[] { '\n' }, 1, text -> {}));
        rejects(() -> new FrameCodec().accept(new byte[] { '"', (byte) 0xc3, '"', '\n' }, 4, text -> {}));
        rejects(() -> new FrameCodec().accept(new byte[4097], 4097, text -> {}));

        byte[] partial = "{\"a\":".getBytes(StandardCharsets.UTF_8);
        decoder.accept(partial, partial.length, text -> {});
        check(decoder.hasPartialFrame());
        decoder.clear();
        check(!decoder.hasPartialFrame());
        received.clear(); decoder.accept(FrameCodec.encode("{}"), 3, received::add);
        check(received.equals(List.of("{}")));
        System.out.println("FrameCodec: " + assertions + " checks passed");
    }
}
