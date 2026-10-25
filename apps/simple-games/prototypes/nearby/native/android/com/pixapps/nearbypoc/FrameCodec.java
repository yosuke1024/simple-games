package com.pixapps.nearbypoc;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Bounded newline-delimited UTF-8, independent of BLE packet and TCP read boundaries. */
final class FrameCodec {
    static final int MAX_BYTES = 4096;
    private final byte[] pending = new byte[MAX_BYTES];
    private int length;

    interface Receiver { void receive(String frame) throws Exception; }

    static byte[] encode(String text) throws CharacterCodingException {
        if (text == null || text.isEmpty() || text.indexOf('\n') >= 0) {
            throw new IllegalArgumentException("A nonempty JSON frame without a raw newline is required");
        }
        if (text.length() > MAX_BYTES) throw new IllegalArgumentException("Frame exceeds 4096 UTF-8 bytes");
        ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).encode(CharBuffer.wrap(text));
        if (encoded.remaining() > MAX_BYTES) throw new IllegalArgumentException("Frame exceeds 4096 UTF-8 bytes");
        byte[] frame = new byte[encoded.remaining() + 1];
        encoded.get(frame, 0, frame.length - 1);
        frame[frame.length - 1] = '\n';
        return frame;
    }

    void accept(byte[] bytes, int count, Receiver receiver) throws Exception {
        for (int i = 0; i < count; i++) {
            if (bytes[i] == '\n') {
                if (length == 0) throw new IllegalArgumentException("Empty frame");
                String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(pending, 0, length)).toString();
                length = 0;
                receiver.receive(text);
            } else {
                if (length == MAX_BYTES) throw new IllegalArgumentException("Incoming frame exceeds 4096 bytes");
                pending[length++] = bytes[i];
            }
        }
    }

    boolean hasPartialFrame() { return length > 0; }
    void clear() { Arrays.fill(pending, (byte) 0); length = 0; }

}
