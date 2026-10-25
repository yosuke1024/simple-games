package com.pixapps.simplegames.nearby;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Storage byte/Unicode boundaries only. JSON shape and retention rules belong to the app. */
final class HistoryPayload {
    static final int MAX_BYTES = 2 * 1024 * 1024;
    static final class SizeException extends IOException {
        SizeException() { super("History exceeds 2 MiB"); }
    }
    private HistoryPayload() {}

    static byte[] encode(String data) throws IOException {
        if (data == null) throw new IOException("History data is required");
        if (data.length() > MAX_BYTES) throw new SizeException();
        ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            .encode(CharBuffer.wrap(data));
        if (encoded.remaining() > MAX_BYTES) throw new SizeException();
        byte[] result = new byte[encoded.remaining()];
        encoded.get(result);
        return result;
    }

    static String read(InputStream input) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int count;
        while ((count = input.read(chunk)) != -1) {
            if (bytes.size() > MAX_BYTES - count) throw new SizeException();
            bytes.write(chunk, 0, count);
        }
        return StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
    }
}
