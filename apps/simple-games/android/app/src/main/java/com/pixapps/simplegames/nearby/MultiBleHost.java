package com.pixapps.simplegames.nearby;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothStatusCodes;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** A single GATT service with up to three independently framed and authenticated guest links. */
@SuppressLint("MissingPermission")
@SuppressWarnings("deprecation")
final class MultiBleHost implements Transport {
    private final Context context;
    private final Events events;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final PausableDeadlines deadlines = new PausableDeadlines(new PausableDeadlines.Scheduler() {
        public void post(Runnable callback, long delay) { main.postDelayed(callback, delay); }
        public void remove(Runnable callback) { main.removeCallbacks(callback); }
    });
    private final PeerLinks<Channel> channels = new PeerLinks<>();
    private final Map<BluetoothDevice, Channel> subscribed = new LinkedHashMap<>();
    private final Map<BluetoothDevice, Runnable> candidates = new LinkedHashMap<>();
    private final ArrayDeque<Channel> senders = new ArrayDeque<>();
    // Serializing notifications also prevents pre-API-33 characteristic value races across peers.
    private Channel writing;
    private final Runnable writeTimeout = () -> {
        Channel previous = writing;
        writing = null;
        if (previous != null) closeChannel(previous, "BLE send callback timed out");
        pump();
    };
    private BluetoothGattServer server;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattCharacteristic tx;
    private volatile boolean active;
    private boolean observing;
    private String label;
    private byte[] listing;
    private final AtomicInteger callbacks = new AtomicInteger();
    private final AtomicBoolean overflow = new AtomicBoolean();
    private final BroadcastReceiver adapterState = new BroadcastReceiver() {
        @Override public void onReceive(Context ignored, Intent intent) {
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(intent.getAction()) &&
                (state == BluetoothAdapter.STATE_TURNING_OFF || state == BluetoothAdapter.STATE_OFF))
                dispatch(null, () -> fail("bluetooth-disabled", "Bluetooth is switched off"));
        }
    };

    private final class Channel {
        final BluetoothDevice device;
        final boolean indicate;
        final FrameCodec decoder = new FrameCodec();
        final ArrayDeque<byte[]> frames = new ArrayDeque<>();
        final Runnable receiveTimeout = () -> closeChannel(this, "Incomplete BLE frame timed out");
        final Runnable drainTimeout = () -> closeChannel(this, "disconnected");
        boolean closing;
        String id;
        int offset;
        int chunkLength;
        Channel(BluetoothDevice device, boolean indicate) { this.device = device; this.indicate = indicate; }
        boolean current() { return active && channels.get(id) == this; }
    }
    private interface Action { void run() throws Exception; }

    MultiBleHost(Context context, Events events) { this.context = context; this.events = events; }

    public void start(boolean advertise, String label, byte[] listing) {
        if (!advertise) throw new IllegalArgumentException("MultiBleHost only hosts");
        BluetoothManager manager = context.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Enable Bluetooth before starting");
        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null || !adapter.isMultipleAdvertisementSupported())
            throw new IllegalStateException("This phone cannot advertise BLE; join from this phone instead");
        this.label = label; this.listing = listing; active = true;
        IntentFilter filter = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(adapterState, filter, Context.RECEIVER_EXPORTED);
        else context.registerReceiver(adapterState, filter);
        observing = true;
        server = manager.openGattServer(context, callback);
        if (server == null) throw new IllegalStateException("Could not open GATT server");
        BluetoothGattService service = new BluetoothGattService(BleTransport.SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        service.addCharacteristic(new BluetoothGattCharacteristic(BleTransport.RX,
            BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE));
        tx = new BluetoothGattCharacteristic(BleTransport.TX,
            BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE, 0);
        tx.addDescriptor(new BluetoothGattDescriptor(BleTransport.CCC,
            BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        service.addCharacteristic(tx);
        service.addCharacteristic(new BluetoothGattCharacteristic(BleTransport.META,
            BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));
        if (!server.addService(service)) throw new IllegalStateException("Could not add BLE service");
    }

    public void connect(String peerId) { throw new IllegalStateException("A host accepts connections"); }
    public void send(byte[] frame) { throw new IllegalArgumentException("peerId is required"); }
    public void send(byte[] frame, String peerId) {
        Channel channel = channels.get(peerId);
        if (channel == null || !channel.current() || channel.closing) throw new IllegalStateException("BLE peer is not connected");
        if (channel.frames.size() >= 16) throw new IllegalStateException("BLE peer send queue is full (16 frames)");
        channel.frames.add(frame);
        if (writing != channel && !senders.contains(channel)) senders.addLast(channel);
        pump();
    }
    public void disconnect(String peerId) {
        if (peerId == null) throw new IllegalArgumentException("peerId is required");
        Channel channel = channels.get(peerId);
        if (channel != null && !channel.closing) {
            channel.closing = true;
            if (channel.frames.isEmpty()) closeChannel(channel, "disconnected");
            else deadlines.post(channel.drainTimeout, 5_000);
        }
    }
    private void pump() {
        if (!active || writing != null) return;
        Channel channel;
        do { channel = senders.pollFirst(); }
        while (channel != null && (!channel.current() || channel.frames.isEmpty()));
        if (channel == null) return;
        byte[] frame = channel.frames.peek();
        channel.chunkLength = Math.min(20, frame.length - channel.offset);
        byte[] fragment = Arrays.copyOfRange(frame, channel.offset, channel.offset + channel.chunkLength);
        writing = channel;
        deadlines.post(writeTimeout, 5_000);
        try {
            boolean accepted;
            if (Build.VERSION.SDK_INT >= 33)
                accepted = server.notifyCharacteristicChanged(channel.device, tx, channel.indicate, fragment) == BluetoothStatusCodes.SUCCESS;
            else {
                tx.setValue(fragment);
                accepted = server.notifyCharacteristicChanged(channel.device, tx, channel.indicate);
            }
            if (!accepted) sent(channel.device, -1);
        } catch (Exception error) { sent(channel.device, -1); }
    }
    private void sent(BluetoothDevice device, int status) {
        Channel channel = writing;
        if (channel == null || !channel.device.equals(device)) return;
        writing = null; deadlines.remove(writeTimeout);
        if (channel.current()) {
            if (status != BluetoothGatt.GATT_SUCCESS) closeChannel(channel, "BLE fragment write failed");
            else {
                channel.offset += channel.chunkLength;
                if (channel.offset == channel.frames.peek().length) { channel.frames.remove(); channel.offset = 0; }
                if (!channel.frames.isEmpty()) senders.addLast(channel);
                else if (channel.closing) closeChannel(channel, "disconnected");
            }
        }
        pump();
    }
    private void closeChannel(Channel channel, String reason) {
        if (channels.get(channel.id) != channel) return;
        channels.remove(channel.id); subscribed.remove(channel.device);
        senders.remove(channel); channel.frames.clear(); channel.decoder.clear();
        deadlines.remove(channel.receiveTimeout); deadlines.remove(channel.drainTimeout);
        try { if (server != null) server.cancelConnection(channel.device); } catch (Exception ignored) {}
        // Keep an outstanding notification's slot until its callback/deadline. This stops
        // late completion from being credited to another guest's frame.
        if (active) events.disconnected(channel.id, reason);
        pump();
    }
    private void removeCandidate(BluetoothDevice device) {
        Runnable deadline = candidates.remove(device);
        if (deadline != null) deadlines.remove(deadline);
    }
    private void reject(BluetoothDevice device) {
        removeCandidate(device);
        try { if (server != null) server.cancelConnection(device); } catch (Exception ignored) {}
    }
    private void dispatch(BluetoothDevice device, Action action) {
        if (!active) return;
        if (callbacks.incrementAndGet() > 64) {
            callbacks.decrementAndGet();
            if (overflow.compareAndSet(false, true)) main.post(() -> {
                overflow.set(false);
                if (!active) return;
                Channel channel = subscribed.get(device);
                if (channel != null) closeChannel(channel, "BLE peer callback queue overflow");
                else if (device != null) reject(device);
                else fail("receive-overflow", "BLE callback queue overflow");
            });
            return;
        }
        main.post(() -> {
            try { if (active) action.run(); }
            catch (Exception error) {
                Channel channel = subscribed.get(device);
                if (channel != null) closeChannel(channel, "BLE peer operation failed");
                else if (device != null) reject(device);
                else fail("ble-error", "Bluetooth operation failed");
            } finally { callbacks.decrementAndGet(); }
        });
    }

    private final AdvertiseCallback advertisement = new AdvertiseCallback() {
        @Override public void onStartSuccess(AdvertiseSettings settings) {
            dispatch(null, () -> events.status("BLE room advertising started"));
        }
        @Override public void onStartFailure(int code) {
            dispatch(null, () -> fail("advertise-failed", "BLE advertising failed: " + code));
        }
    };
    private final BluetoothGattServerCallback callback = new BluetoothGattServerCallback() {
        @Override public void onServiceAdded(int status, BluetoothGattService service) { dispatch(null, () -> {
            if (status != BluetoothGatt.GATT_SUCCESS) { fail("service-failed", "Could not add BLE service"); return; }
            AdvertiseData primary = new AdvertiseData.Builder().addServiceUuid(new ParcelUuid(BleTransport.SERVICE)).build();
            AdvertiseData response = new AdvertiseData.Builder().addServiceData(new ParcelUuid(BleTransport.SERVICE),
                label.getBytes(StandardCharsets.US_ASCII)).build();
            advertiser.startAdvertising(new AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true).setTimeout(0).build(), primary, response, advertisement);
        }); }
        @Override public void onConnectionStateChange(BluetoothDevice device, int status, int state) { dispatch(device, () -> {
            if (state == BluetoothProfile.STATE_DISCONNECTED) {
                removeCandidate(device);
                Channel channel = subscribed.get(device);
                if (channel != null) closeChannel(channel, "BLE peer disconnected");
                return;
            }
            if (state != BluetoothProfile.STATE_CONNECTED) return;
            if (subscribed.containsKey(device) || candidates.containsKey(device)) return;
            if (status != BluetoothGatt.GATT_SUCCESS || candidates.size() >= 4 ||
                (writing != null && writing.device.equals(device) && !writing.current())) { reject(device); return; }
            Runnable timeout = () -> reject(device);
            candidates.put(device, timeout); deadlines.post(timeout, 15_000);
        }); }
        @Override public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset,
            BluetoothGattCharacteristic characteristic) { dispatch(device, () -> {
            if (!BleTransport.META.equals(characteristic.getUuid()) || !candidates.containsKey(device)) {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null); return;
            }
            try {
                byte[] value = ListingPayload.read(channels.size() < PeerLinks.CAPACITY ? listing : null, offset);
                server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value);
            } catch (IllegalArgumentException error) {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null);
            }
        }); }
        @Override public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattDescriptor descriptor, boolean prepared, boolean responseNeeded, int offset, byte[] value) {
            byte[] copy = value == null || value.length > 20 ? null : value.clone();
            dispatch(device, () -> {
                boolean indicate = Arrays.equals(copy, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
                boolean valid = BleTransport.CCC.equals(descriptor.getUuid()) && BleTransport.TX.equals(descriptor.getCharacteristic().getUuid()) &&
                    !prepared && responseNeeded && offset == 0 &&
                    (indicate || Arrays.equals(copy, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE));
                Channel channel = subscribed.get(device);
                boolean added = false;
                if (valid && channel == null && candidates.containsKey(device)) {
                    channel = new Channel(device, indicate);
                    channel.id = channels.add(channel);
                    if (channel.id != null) {
                        subscribed.put(device, channel); removeCandidate(device); added = true;
                    } else channel = null;
                }
                valid = valid && channel != null && channel.indicate == indicate;
                if (responseNeeded) server.sendResponse(device, requestId,
                    valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
                if (valid && added) events.connected(channel.id);
                else if (!valid) {
                    if (channel != null) closeChannel(channel, "Unsupported BLE subscription or unsubscribe");
                    else reject(device);
                }
            });
        }
        @Override public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattCharacteristic characteristic, boolean prepared, boolean responseNeeded, int offset, byte[] value) {
            byte[] copy = value == null || value.length > 20 ? null : value.clone();
            dispatch(device, () -> {
                Channel channel = subscribed.get(device);
                boolean valid = channel != null && BleTransport.RX.equals(characteristic.getUuid()) && !prepared &&
                    responseNeeded && offset == 0 && copy != null && copy.length > 0;
                if (responseNeeded) server.sendResponse(device, requestId,
                    valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
                if (!valid) {
                    if (channel != null) closeChannel(channel, "Unsupported BLE write request");
                    return;
                }
                channel.decoder.accept(copy, copy.length, text -> events.data(channel.id, text));
                deadlines.remove(channel.receiveTimeout);
                if (channel.decoder.hasPartialFrame()) deadlines.post(channel.receiveTimeout, 5_000);
            });
        }
        @Override public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset,
            BluetoothGattDescriptor descriptor) { dispatch(device, () -> {
            Channel channel = subscribed.get(device);
            boolean valid = (channel != null || candidates.containsKey(device)) && BleTransport.CCC.equals(descriptor.getUuid()) && offset == 0;
            byte[] value = channel == null ? BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE :
                channel.indicate ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;
            server.sendResponse(device, requestId, valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, valid ? value : null);
        }); }
        @Override public void onExecuteWrite(BluetoothDevice device, int requestId, boolean execute) { dispatch(device, () -> {
            server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
            Channel channel = subscribed.get(device);
            if (channel != null) closeChannel(channel, "Prepared writes are unsupported");
        }); }
        @Override public void onNotificationSent(BluetoothDevice device, int status) { dispatch(device, () -> sent(device, status)); }
    };

    private void fail(String code, String message) { if (active) { stop(); events.failed(code, message); } }
    public void setForeground(boolean foreground) { deadlines.setActive(foreground); }
    public void stop() {
        active = false;
        if (observing) { observing = false; try { context.unregisterReceiver(adapterState); } catch (Exception ignored) {} }
        deadlines.clear(); main.removeCallbacksAndMessages(null);
        if (advertiser != null) { try { advertiser.stopAdvertising(advertisement); } catch (Exception ignored) {} advertiser = null; }
        if (server != null) {
            for (BluetoothDevice device : candidates.keySet()) { try { server.cancelConnection(device); } catch (Exception ignored) {} }
            for (Channel channel : channels.values()) { try { server.cancelConnection(channel.device); } catch (Exception ignored) {} }
            try { server.close(); } catch (Exception ignored) {}
            server = null;
        }
        channels.clear(); subscribed.clear(); candidates.clear(); senders.clear(); writing = null;
    }
}
