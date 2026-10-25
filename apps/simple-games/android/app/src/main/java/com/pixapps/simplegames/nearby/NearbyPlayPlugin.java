package com.pixapps.simplegames.nearby;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Foreground Nearby Play transport. Radio work starts only after an explicit start call. */
@CapacitorPlugin(name = "NearbyPlay", permissions = {
    @Permission(alias = "scan", strings = { Manifest.permission.BLUETOOTH_SCAN }),
    @Permission(alias = "advertise", strings = { Manifest.permission.BLUETOOTH_ADVERTISE }),
    @Permission(alias = "connect", strings = { Manifest.permission.BLUETOOTH_CONNECT }),
    @Permission(alias = "legacyLocation", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
})
public class NearbyPlayPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private Transport transport;
    private PluginCall pendingStart;
    private long generation;
    private final ForegroundStartGate foreground = new ForegroundStartGate();
    // Shared across Activity/plugin recreation: AtomicFile itself does not serialize callers.
    // No thread starts until explicit history access; the idle worker exits after ten seconds.
    private static final ThreadPoolExecutor HISTORY_TASKS = new ThreadPoolExecutor(1, 1, 10, TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(4), task -> {
            Thread thread = new Thread(task, "nearby-history");
            thread.setDaemon(true);
            return thread;
        });
    static { HISTORY_TASKS.allowCoreThreadTimeOut(true); }

    @PluginMethod public void capabilities(PluginCall call) {
        BluetoothManager manager = getContext().getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        boolean supported = adapter != null && getContext().getPackageManager()
            .hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE);
        boolean enabled = false;
        boolean advertise = false;
        boolean known = Build.VERSION.SDK_INT < 31 || getPermissionState("connect") == PermissionState.GRANTED;
        try {
            advertise = adapter != null && adapter.isMultipleAdvertisementSupported();
            enabled = adapter != null && adapter.isEnabled();
        } catch (SecurityException ignored) {
            // No permission dialog on capability probes. Start is still available.
        }
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("bleSupported", supported);
        result.put("canAdvertise", advertise);
        result.put("bluetoothEnabled", enabled);
        result.put("availabilityKnown", known);
        call.resolve(result);
    }

    @PluginMethod public void start(PluginCall call) { main.post(() -> {
        if (!foreground.isForeground()) { call.reject("App must be in the foreground"); return; }
        if (transport != null || pendingStart != null) { call.reject("Stop the previous session first"); return; }
        String kind = call.getString("transport");
        String role = call.getString("role");
        String label = call.getString("label");
        if ((!"ble".equals(kind) && !"lan".equals(kind)) ||
            (!"advertise".equals(role) && !"browse".equals(role)) ||
            !DiscoveryLabel.valid(label)) {
            call.reject("transport, role and a P-/F- label with six hex digits are required"); return;
        }
        pendingStart = call;
        ArrayList<String> aliases = new ArrayList<>();
        if ("ble".equals(kind)) {
            if (Build.VERSION.SDK_INT >= 31) {
                aliases.add("connect");
                aliases.add("advertise".equals(role) ? "advertise" : "scan");
            } else if ("browse".equals(role)) aliases.add("legacyLocation");
        }
        aliases.removeIf(alias -> getPermissionState(alias) == PermissionState.GRANTED);
        if (aliases.isEmpty()) begin(call);
        else {
            try { requestPermissionForAliases(aliases.toArray(new String[0]), call, "permissionsResult"); }
            catch (Exception e) { pendingStart = null; call.reject("Could not request Bluetooth permission"); }
        }
    }); }

    @PermissionCallback private void permissionsResult(PluginCall call) { main.post(() -> {
        if (pendingStart != call) return;
        String role = call.getString("role");
        boolean granted = Build.VERSION.SDK_INT >= 31
            ? getPermissionState("connect") == PermissionState.GRANTED &&
              getPermissionState("advertise".equals(role) ? "advertise" : "scan") == PermissionState.GRANTED
            : getPermissionState("legacyLocation") == PermissionState.GRANTED;
        if (!granted) {
            pendingStart = null;
            foreground.clearPending();
            call.reject("Bluetooth permission denied");
            event("error", "code", "permission-denied", "message", "Bluetooth permission was not granted");
        } else if (foreground.permissionGranted()) begin(call);
    }); }

    private void begin(PluginCall call) {
        pendingStart = null;
        foreground.clearPending();
        long epoch = ++generation;
        Transport.Events events = new Transport.Events() {
            private void active(Runnable action) {
                Runnable guarded = () -> { if (generation == epoch && transport != null) action.run(); };
                if (Looper.myLooper() == Looper.getMainLooper()) guarded.run(); else main.post(guarded);
            }
            public void peer(String id, String name) { active(() -> event("peer", "id", id, "name", name)); }
            public void connected() { active(() -> event("connected")); }
            public void status(String message) { active(() -> event("status", "message", message)); }
            public void data(String data) { active(() -> {
                event("data", "data", data);
            }); }
            public void failed(String code, String message) { active(() -> fail(code, message)); }
            public void disconnected(String reason) { active(() -> end(reason)); }
        };
        try {
            transport = "ble".equals(call.getString("transport"))
                ? new BleTransport(getContext(), events) : new LanTransport(getContext(), events);
            transport.start("advertise".equals(call.getString("role")), call.getString("label"));
            call.resolve();
        } catch (Exception e) {
            fail("start-failed", message(e));
            call.reject(message(e));
        }
    }

    @PluginMethod public void connect(PluginCall call) { main.post(() -> {
        try {
            if (transport == null) throw new IllegalStateException("Start discovery first");
            transport.connect(call.getString("peerId"));
            call.resolve();
        } catch (Exception e) { call.reject(message(e)); }
    }); }

    @PluginMethod public void send(PluginCall call) { main.post(() -> {
        try {
            if (transport == null) throw new IllegalStateException("No session");
            String data = call.getString("data");
            byte[] frame = FrameCodec.encode(data);
            transport.send(frame);
            call.resolve();
        } catch (Exception e) {
            call.reject(message(e));
            fail("send-failed", message(e));
        }
    }); }

    @PluginMethod public void stop(PluginCall call) { main.post(() -> { end("stopped"); call.resolve(); }); }

    @PluginMethod public void readHistory(PluginCall call) {
        history(call, "HISTORY_READ", store -> {
            String data = store.read();
            JSObject result = new JSObject();
            result.put("data", data == null ? JSONObject.NULL : data);
            return result;
        });
    }

    @PluginMethod public void writeHistory(PluginCall call) {
        Object raw = call.getData().opt("data");
        if (!(raw instanceof String)) {
            call.reject("History data must be a string", "HISTORY_WRITE"); return;
        }
        String data = (String) raw;
        if (data.length() > HistoryPayload.MAX_BYTES) {
            call.reject("History exceeds 2 MiB", "HISTORY_SIZE"); return;
        }
        history(call, "HISTORY_WRITE", store -> { store.write(data); return null; });
    }

    @PluginMethod public void clearHistory(PluginCall call) {
        history(call, "HISTORY_CLEAR", store -> { store.clear(); return null; });
    }

    private interface HistoryOperation { JSObject run(LocalHistoryStore store) throws Exception; }
    private void history(PluginCall call, String errorCode, HistoryOperation operation) {
        Context context = getContext().getApplicationContext();
        try {
            HISTORY_TASKS.execute(() -> {
                try {
                    JSObject result = operation.run(new LocalHistoryStore(context));
                    if (result == null) call.resolve(); else call.resolve(result);
                } catch (HistoryPayload.SizeException error) { call.reject(message(error), "HISTORY_SIZE"); }
                catch (Exception error) { call.reject(message(error), errorCode); }
            });
        } catch (RejectedExecutionException error) {
            call.reject("History storage is busy", "HISTORY_BUSY");
        }
    }

    private void fail(String code, String message) { event("error", "code", code, "message", message); end(code); }
    private void end(String reason) {
        ++generation;
        foreground.clearPending();
        if (pendingStart != null) { pendingStart.reject("Start cancelled"); pendingStart = null; }
        Transport previous = transport;
        transport = null;
        if (previous != null) { previous.stop(); event("disconnected", "reason", reason); }
    }
    private void event(String type, String... pairs) {
        JSObject event = new JSObject(); event.put("type", type);
        for (int i = 0; i < pairs.length; i += 2) event.put(pairs[i], pairs[i + 1]);
        notifyListeners("nearbyEvent", event);
    }
    private static String message(Exception error) { return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage(); }
    @Override protected void handleOnResume() { main.post(() -> {
        if (foreground.resume() && pendingStart != null) begin(pendingStart);
    }); }
    @Override protected void handleOnPause() { main.post(() -> {
        foreground.pause();
        // Stop all live I/O immediately. A pending OS permission dialog has no I/O to stop.
        if (transport != null) end("background");
    }); }
    @Override protected void handleOnStop() { main.post(() -> {
        foreground.background(); end("background");
    }); }
    @Override protected void handleOnDestroy() { main.post(() -> {
        foreground.background(); end("destroyed");
    }); }
}
