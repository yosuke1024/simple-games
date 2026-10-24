package com.pixapps.simplegames;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;

/**
 * Pins one game to the home screen when the player asks for it (issue #110).
 *
 * The whole of the native side of that feature: the JavaScript in
 * src/services/homeShortcut/ decides what to pin (label, icon, the URI the
 * Intent carries) and this class hands it to {@link ShortcutManagerCompat}.
 * Nothing here knows what a game is. The Intent is explicit — this app's
 * bridge activity, ACTION_VIEW, the URI as data — so no intent-filter is
 * declared for it and nothing outside the app can open a game this way.
 * The URI is read back on launch by Capacitor's own App plugin
 * (getLaunchUrl on a cold start, appUrlOpen through onNewIntent on a warm
 * one; the activity is singleTask), so there is no reading side here.
 *
 * Every answer is a plain result. The launcher shows its own confirmation
 * and never reports what the player chose; a launcher that takes no pin
 * requests, or a request it refuses, resolves {@code requested: false}
 * rather than failing, and the sheet that asked never blocks on any of it.
 *
 * R8 keeps this class through @capacitor/android's consumer rules (every
 * {@code @CapacitorPlugin} subclass of {@link Plugin}); see proguard-rules.pro.
 */
@CapacitorPlugin(name = "HomeShortcut")
public class HomeShortcutPlugin extends Plugin {

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("supported", ShortcutManagerCompat.isRequestPinShortcutSupported(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        String id = call.getString("id");
        String label = call.getString("label");
        String uri = call.getString("uri");
        if (isBlank(id) || isBlank(label) || isBlank(uri)) {
            call.reject("id, label and uri are required");
            return;
        }

        JSObject ret = new JSObject();
        try {
            if (!ShortcutManagerCompat.isRequestPinShortcutSupported(getContext())) {
                ret.put("requested", false);
                call.resolve(ret);
                return;
            }

            // The launcher starts this on the player's behalf; singleTask in
            // the manifest turns it into onNewIntent when the app is already
            // running, which is the warm-start path the JavaScript listens for.
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.setClass(getContext(), getActivity().getClass());

            IconCompat icon = iconFrom(call.getString("icon"));
            ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(getContext(), id)
                .setShortLabel(label)
                .setLongLabel(label)
                .setIcon(icon != null ? icon : IconCompat.createWithResource(
                    getContext(), getContext().getApplicationInfo().icon))
                .setIntent(intent)
                .build();

            // Pinning an existing ID reuses its stored icon. Refresh that one
            // record only when the player asks again; unknown IDs are ignored.
            // A failed drawing must never replace an existing game picture
            // with the app-icon fallback used for a new shortcut.
            if (icon != null) {
                try {
                    ShortcutManagerCompat.updateShortcuts(getContext(), Collections.singletonList(shortcut));
                } catch (Exception ignored) {
                    // An optional refresh must not prevent the usual pin request.
                }
            }

            ret.put("requested", ShortcutManagerCompat.requestPinShortcut(getContext(), shortcut, null));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not request the shortcut", e);
        }
    }

    /**
     * The picture the JavaScript drew (a base64 PNG, a full-bleed adaptive
     * layer — src/services/homeShortcut/icon.ts), or null when none came or
     * it cannot be decoded. Keep failure distinct from the app-icon fallback
     * so an existing shortcut retains its picture when drawing fails.
     */
    private IconCompat iconFrom(String base64Png) {
        if (!isBlank(base64Png)) {
            try {
                byte[] bytes = Base64.decode(base64Png, Base64.DEFAULT);
                Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (bitmap != null) {
                    return IconCompat.createWithAdaptiveBitmap(bitmap);
                }
            } catch (IllegalArgumentException ignored) {
                // Not base64. The caller keeps the existing picture, if any.
            }
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
