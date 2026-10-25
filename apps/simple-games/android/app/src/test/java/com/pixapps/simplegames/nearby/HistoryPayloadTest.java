package com.pixapps.simplegames.nearby;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.Test;

public final class HistoryPayloadTest {
    private interface Action { void run() throws Exception; }
    private static void rejects(Action action) throws Exception {
        try { action.run(); fail("Expected invalid storage payload to fail"); }
        catch (IOException expected) { /* The caller can preserve its prior history and show a failure. */ }
    }

    @Test public void preservesUnicodeNewlinesAndOpaqueJsonText() throws Exception {
        for (String data : new String[] {"", "null", "[]", "{\"name\":\"日本語🙂\"}\n", "not json"}) {
            byte[] encoded = HistoryPayload.encode(data);
            assertArrayEquals(data.getBytes(StandardCharsets.UTF_8), encoded);
            // Disk read boundaries can fall in the middle of a multibyte character.
            try (FilterInputStream input = new FilterInputStream(new ByteArrayInputStream(encoded)) {
                @Override public int read(byte[] bytes, int start, int length) throws IOException {
                    return super.read(bytes, start, Math.min(length, 1));
                }
            }) { assertEquals(data, HistoryPayload.read(input)); }
        }
    }

    @Test public void enforcesUtf8BytesOnWriteAndBoundedReads() throws Exception {
        String ascii = "a".repeat(HistoryPayload.MAX_BYTES);
        assertEquals(HistoryPayload.MAX_BYTES, HistoryPayload.encode(ascii).length);
        assertEquals(ascii, HistoryPayload.read(new ByteArrayInputStream(ascii.getBytes(StandardCharsets.US_ASCII))));
        rejects(() -> HistoryPayload.encode(ascii + "a"));
        String unicode = "🙂".repeat(HistoryPayload.MAX_BYTES / 4);
        assertEquals(HistoryPayload.MAX_BYTES, HistoryPayload.encode(unicode).length);
        rejects(() -> HistoryPayload.encode(unicode + "🙂"));
        byte[] oversized = new byte[HistoryPayload.MAX_BYTES + 1];
        Arrays.fill(oversized, (byte) 'a');
        rejects(() -> HistoryPayload.read(new ByteArrayInputStream(oversized)));
    }

    @Test public void rejectsMalformedUnicodeInsteadOfReplacingHistory() throws Exception {
        rejects(() -> HistoryPayload.encode(null));
        rejects(() -> HistoryPayload.encode("\ud800"));
        rejects(() -> HistoryPayload.encode("\udc00"));
        for (byte[] invalid : new byte[][] {{(byte) 0xff}, {(byte) 0xc0, (byte) 0xaf},
                {(byte) 0xf0, (byte) 0x9f}, {(byte) 0xed, (byte) 0xa0, (byte) 0x80}}) {
            rejects(() -> HistoryPayload.read(new ByteArrayInputStream(invalid)));
        }
    }
}
