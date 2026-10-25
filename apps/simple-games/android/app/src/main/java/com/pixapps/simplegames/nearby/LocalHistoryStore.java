package com.pixapps.simplegames.nearby;

import android.content.Context;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/** Called only on the plugin's serial storage executor; excluded from Android backup. */
final class LocalHistoryStore {
    private final File file;
    private final AtomicFile atomic;

    LocalHistoryStore(Context context) throws IOException {
        File directory = context.getNoBackupFilesDir();
        if (directory == null) throw new IOException("Private history storage is unavailable");
        file = new File(directory, "nearby-play-history.json");
        atomic = new AtomicFile(file);
    }

    String read() throws IOException {
        try (InputStream input = atomic.openRead()) { return HistoryPayload.read(input); }
        catch (FileNotFoundException error) {
            if (!file.exists() && !new File(file.getPath() + ".bak").exists()) return null;
            throw error;
        }
    }

    void write(String data) throws IOException {
        byte[] bytes = HistoryPayload.encode(data);
        FileOutputStream output = null;
        try {
            output = atomic.startWrite();
            output.write(bytes);
            output.getFD().sync();
            atomic.finishWrite(output);
            output = null;
            // AtomicFile can log a failed rename instead of throwing; do not report a lost write as saved.
            try (InputStream input = atomic.openRead()) {
                byte[] chunk = new byte[8192];
                int offset = 0;
                int count;
                while ((count = input.read(chunk)) != -1) {
                    if (offset > bytes.length - count) throw new IOException("Nearby history write could not be verified");
                    for (int i = 0; i < count; i++) {
                        if (chunk[i] != bytes[offset + i]) throw new IOException("Nearby history write could not be verified");
                    }
                    offset += count;
                }
                if (offset != bytes.length) throw new IOException("Nearby history write could not be verified");
            }
        } catch (IOException | RuntimeException error) {
            if (output != null) atomic.failWrite(output);
            throw error;
        }
    }

    void clear() throws IOException {
        atomic.delete();
        if (file.exists() || new File(file.getPath() + ".bak").exists() || new File(file.getPath() + ".new").exists()) {
            throw new IOException("Nearby history could not be deleted");
        }
    }
}
