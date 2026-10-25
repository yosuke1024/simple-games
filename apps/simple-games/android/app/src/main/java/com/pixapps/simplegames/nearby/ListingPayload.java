package com.pixapps.simplegames.nearby;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Public discovery bytes only. JS validates the bounded JSON schema and selected room. */
final class ListingPayload {
    static final int MAX_BYTES = 255;
    static final int MAX_TXT_BYTES = MAX_BYTES - "listing=".length();
    private ListingPayload() {}

    static byte[] encode(String text, int limit) {
        if (text == null) return null;
        if (text.length() == 0 || text.length() > limit) throw new IllegalArgumentException("Listing exceeds its UTF-8 byte limit");
        try {
            ByteBuffer encoded = StandardCharsets.UTF_8.newEncoder()
                .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                .encode(CharBuffer.wrap(text));
            if (encoded.remaining() == 0 || encoded.remaining() > limit) throw new IllegalArgumentException("Listing exceeds its UTF-8 byte limit");
            byte[] result = new byte[encoded.remaining()]; encoded.get(result); return result;
        } catch (CharacterCodingException error) { throw new IllegalArgumentException("Listing must be valid UTF-8"); }
    }
    static String decode(byte[] value) {
        if (value == null || value.length == 0 || value.length > MAX_BYTES) return null;
        try {
            return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(value)).toString();
        } catch (CharacterCodingException error) { return null; }
    }
    static byte[] read(byte[] value, int offset) {
        byte[] data = value == null ? new byte[0] : value;
        if (offset < 0 || offset > data.length) throw new IllegalArgumentException("Invalid listing offset");
        return Arrays.copyOfRange(data, offset, data.length);
    }
}
