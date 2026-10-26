package com.pixapps.simplegames.nearby;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
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
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanFilter;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.BroadcastReceiver;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.os.SystemClock;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** Android-standard GATT only. All mutable state and callback processing run on main. */
@SuppressLint("MissingPermission") // NearbyPlayPlugin requests only the selected role's permission before creation.
@SuppressWarnings("deprecation") // Legacy overloads keep Nearby Play usable from Android 7 (API 24).
final class BleTransport implements Transport {
    static final UUID SERVICE = UUID.fromString("9b5d2000-7a4c-4e13-a280-75d53c01a268");
    static final UUID RX = UUID.fromString("9b5d2001-7a4c-4e13-a280-75d53c01a268");
    static final UUID TX = UUID.fromString("9b5d2002-7a4c-4e13-a280-75d53c01a268");
    static final UUID META = UUID.fromString("9b5d2003-7a4c-4e13-a280-75d53c01a268");
    static final UUID CCC = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private final Context context;
    private final Events events;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final PausableDeadlines deadlines = new PausableDeadlines(new PausableDeadlines.Scheduler() {
        public void post(Runnable callback, long delay) { main.postDelayed(callback, delay); }
        public void remove(Runnable callback) { main.removeCallbacks(callback); }
    });
    private final FrameCodec decoder = new FrameCodec();
    private final SubscriptionBuffer earlyNotifications = new SubscriptionBuffer();
    private final DiscoveryIndex<BluetoothDevice> peers = new DiscoveryIndex<>("ble-");
    private final BleAdmission<BluetoothDevice> admission = new BleAdmission<>();
    private final Map<BluetoothDevice, Runnable> candidateTimeouts = new LinkedHashMap<>();
    private BluetoothGatt probe;
    private DiscoveryIndex.Peer<BluetoothDevice> probePeer;
    private boolean probeClosing;
    private boolean probeSucceeded;
    private String probeLabel;
    private String probeListing;
    private boolean foreground = true;
    private byte[] listing;
    private final Runnable probeTimeout = () -> finishProbe(null, false);
    private final Runnable maintenance = this::maintainDiscovery;
    private final ArrayDeque<byte[]> frames = new ArrayDeque<>();
    private final AtomicInteger pendingCallbacks = new AtomicInteger();
    private final AtomicBoolean callbackOverflow = new AtomicBoolean();
    private BluetoothLeScanner scanner;
    private ScanCallback scanCallback;
    private final ForegroundScan scan = new ForegroundScan(new ForegroundScan.Driver() {
        public void start(long generation) {
            scanCallback = createScanCallback(generation);
            scanner.startScan(Collections.singletonList(new ScanFilter.Builder().setServiceUuid(new ParcelUuid(SERVICE)).build()),
                new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scanCallback);
        }
        public void stop() {
            ScanCallback previous = scanCallback;
            scanCallback = null;
            if (scanner != null && previous != null) {
                try { scanner.stopScan(previous); } catch (Exception ignored) { /* Radio/permission may already be unavailable. */ }
            }
        }
    });
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGatt gatt;
    private BluetoothGattServer server;
    private BluetoothGattCharacteristic writeCharacteristic;
    private BluetoothGattCharacteristic notifyCharacteristic;
    private BluetoothDevice remote;
    private volatile boolean active;
    private boolean advertise;
    private boolean ready;
    private boolean writing;
    private boolean indicate;
    private boolean observingAdapter;
    private int offset;
    private int currentChunkLength;
    private String label;
    private final Runnable sessionTimeout = () -> fail("discovery-timeout", "Discovery ended after 60 seconds; start again to retry");
    private final Runnable connectTimeout = () -> fail("connect-timeout", "BLE connection or subscription timed out");
    private final Runnable writeTimeout = () -> fail("write-timeout", "BLE send callback timed out");
    private final Runnable receiveTimeout = () -> fail("frame-timeout", "Incomplete BLE frame timed out");
    private final BroadcastReceiver adapterState = new BroadcastReceiver() {
        @Override public void onReceive(Context ignored, Intent intent) {
            if (!BluetoothAdapter.ACTION_STATE_CHANGED.equals(intent.getAction())) return;
            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR);
            if (state == BluetoothAdapter.STATE_TURNING_OFF || state == BluetoothAdapter.STATE_OFF) {
                run(() -> fail("bluetooth-disabled", "Bluetooth is switched off"));
            }
        }
    };

    BleTransport(Context context, Events events) { this.context = context; this.events = events; }

    public void start(boolean advertise, String label, byte[] listing) {
        BluetoothManager manager = context.getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) throw new IllegalStateException("Enable Bluetooth before starting");
        this.advertise = advertise;
        this.label = label;
        this.listing = listing;
        active = true;
        IntentFilter filter = new IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED);
        // Bluetooth broadcasts originate from a privileged separate process. This action is
        // system-protected; exported here permits the OS sender, not arbitrary app messages.
        if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(adapterState, filter, Context.RECEIVER_EXPORTED);
        else context.registerReceiver(adapterState, filter);
        observingAdapter = true;
        deadlines.post(sessionTimeout, 60_000);
        if (advertise) {
            advertiser = adapter.getBluetoothLeAdvertiser();
            if (advertiser == null || !adapter.isMultipleAdvertisementSupported()) {
                throw new IllegalStateException("This phone cannot advertise BLE; use browse on this phone");
            }
            server = manager.openGattServer(context, serverCallback);
            if (server == null) throw new IllegalStateException("Could not open GATT server");
            BluetoothGattService service = new BluetoothGattService(SERVICE, BluetoothGattService.SERVICE_TYPE_PRIMARY);
            writeCharacteristic = new BluetoothGattCharacteristic(RX,
                BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE);
            notifyCharacteristic = new BluetoothGattCharacteristic(TX,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE, 0);
            notifyCharacteristic.addDescriptor(new BluetoothGattDescriptor(CCC,
                BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
            service.addCharacteristic(writeCharacteristic);
            service.addCharacteristic(notifyCharacteristic);
            service.addCharacteristic(new BluetoothGattCharacteristic(META,
                BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));
            if (!server.addService(service)) throw new IllegalStateException("Could not add BLE service");
        } else {
            scanner = adapter.getBluetoothLeScanner();
            if (scanner == null) throw new IllegalStateException("BLE scanning unavailable");
            scan.start();
            events.status("BLE discovery started (60-second limit)");
            deadlines.post(maintenance, 1_000);
        }
    }

    public void connect(String peerId) {
        if (!active || advertise || gatt != null || remote != null) throw new IllegalStateException("BLE is not available for another connection");
        DiscoveryIndex.Peer<BluetoothDevice> peer = peers.byId(peerId);
        if (peer == null || !peer.announced) throw new IllegalArgumentException("Select a current discovered BLE peer");
        stopScan();
        deadlines.remove(sessionTimeout);
        remote = peer.value;
        deadlines.post(connectTimeout, 15_000);
        // Finish a metadata-only link before opening the real connection, including
        // when the chosen device is the one currently being probed.
        if (probe != null) releaseProbe(); else connectSelected();
    }

    public void send(byte[] frame) {
        if (!active || !ready) throw new IllegalStateException("BLE is not connected and subscribed");
        if (frames.size() >= 16) throw new IllegalStateException("BLE send queue is full (16 frames)");
        frames.add(frame);
        pump();
    }

    private void pump() {
        if (!active || !ready || writing || frames.isEmpty()) return;
        byte[] frame = frames.peek();
        currentChunkLength = Math.min(20, frame.length - offset);
        byte[] chunk = Arrays.copyOfRange(frame, offset, offset + currentChunkLength);
        writing = true;
        deadlines.post(writeTimeout, 5_000);
        try {
            boolean accepted;
            if (advertise) {
                if (Build.VERSION.SDK_INT >= 33) {
                    accepted = server.notifyCharacteristicChanged(remote, notifyCharacteristic, indicate, chunk) == BluetoothStatusCodes.SUCCESS;
                } else {
                    notifyCharacteristic.setValue(chunk);
                    accepted = server.notifyCharacteristicChanged(remote, notifyCharacteristic, indicate);
                }
            } else if (Build.VERSION.SDK_INT >= 33) {
                accepted = gatt.writeCharacteristic(writeCharacteristic, chunk, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS;
            } else {
                writeCharacteristic.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT);
                writeCharacteristic.setValue(chunk);
                accepted = gatt.writeCharacteristic(writeCharacteristic);
            }
            if (!accepted) fail("write-failed", "BLE rejected a fragment");
        } catch (Exception e) { fail("write-failed", "BLE fragment write failed"); }
    }

    private void wrote(int status) {
        if (!writing) return;
        deadlines.remove(writeTimeout);
        if (status != BluetoothGatt.GATT_SUCCESS) { fail("write-failed", "BLE fragment callback failed: " + status); return; }
        writing = false;
        offset += currentChunkLength;
        if (offset == frames.peek().length) { frames.remove(); offset = 0; }
        pump();
    }

    private void received(byte[] value) {
        if (value == null || value.length == 0 || value.length > 20) {
            fail("invalid-frame", "Unexpected BLE fragment"); return;
        }
        if (!ready) {
            try { earlyNotifications.append(value); }
            catch (IllegalStateException error) { fail("invalid-frame", error.getMessage()); }
            return;
        }
        consume(value);
    }

    private void consume(byte[] value) {
        try {
            decoder.accept(value, value.length, events::data);
            deadlines.remove(receiveTimeout);
            if (decoder.hasPartialFrame()) deadlines.post(receiveTimeout, 5_000);
        } catch (Exception e) { fail("invalid-frame", "Malformed or oversized BLE frame"); }
    }

    private void connected() {
        if (ready) return;
        ready = true;
        deadlines.remove(connectTimeout);
        deadlines.remove(sessionTimeout);
        stopAdvertising();
        stopScan();
        events.connected();
        // The peripheral may notify immediately after its CCC subscription callback,
        // before Android delivers our descriptor-write callback. JS sees connected first.
        byte[] early = earlyNotifications.finish();
        if (early.length > 0) consume(early);
    }

    private void run(Runnable action) {
        if (!active) return;
        if (pendingCallbacks.incrementAndGet() > 64) {
            pendingCallbacks.decrementAndGet();
            if (callbackOverflow.compareAndSet(false, true)) main.post(() -> fail("receive-overflow", "BLE callback queue overflow"));
            return;
        }
        main.post(() -> {
            try { if (active) action.run(); }
            catch (Exception e) { fail("ble-error", "Bluetooth operation failed: " + e.getClass().getSimpleName()); }
            finally { pendingCallbacks.decrementAndGet(); }
        });
    }

    private void connectSelected() {
        if (!active || advertise || remote == null || gatt != null) return;
        try {
            gatt = remote.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE);
            if (gatt == null) fail("connect-failed", "Could not create BLE connection");
        } catch (Exception error) { fail("connect-failed", "Could not create BLE connection"); }
    }

    private void maintainDiscovery() {
        if (!active || scanner == null || !foreground) return;
        for (DiscoveryIndex.Peer<BluetoothDevice> peer : peers.expire(SystemClock.elapsedRealtime())) {
            if (peer.announced) events.peerLost(peer.id);
            if (peer == probePeer) releaseProbe();
        }
        for (DiscoveryIndex.Peer<BluetoothDevice> peer : peers.expireListings(SystemClock.elapsedRealtime()))
            events.peerLost(peer.id);
        pumpProbe();
        deadlines.post(maintenance, 1_000);
    }
    private void pumpProbe() {
        if (!active || !foreground || scanner == null || probe != null || remote != null) return;
        probePeer = peers.nextProbe(SystemClock.elapsedRealtime());
        // Older hosts treat any physical connection as joining and would end on
        // probe disconnect. The high game-code bit is the metadata capability flag.
        while (probePeer != null && !DiscoveryLabel.metadataCapable(probePeer.label)) {
            probePeer = peers.nextProbe(SystemClock.elapsedRealtime());
        }
        if (probePeer == null) return;
        probeLabel = probePeer.label; probeListing = null; probeSucceeded = false;
        try {
            probe = probePeer.value.connectGatt(context, false, probeCallback, BluetoothDevice.TRANSPORT_LE);
            if (probe == null) { probePeer = null; return; }
            deadlines.post(probeTimeout, 5_000);
        } catch (Exception ignored) { probe = null; probePeer = null; }
    }
    private void finishProbe(String value, boolean succeeded) {
        if (probe == null || probeClosing) return;
        probeListing = value; probeSucceeded = succeeded;
        releaseProbe();
    }
    private void releaseProbe() {
        if (probe == null || probeClosing) return;
        deadlines.remove(probeTimeout);
        probeClosing = true;
        // Do not overlap links if the OS is slow to report closure. The enclosing
        // 60-second scan / 15-second selection deadline bounds this wait.
        try { probe.disconnect(); } catch (Exception ignored) { /* Wait for closure or the outer deadline. */ }
    }
    private void closedProbe() {
        deadlines.remove(probeTimeout);
        BluetoothGatt closing = probe;
        DiscoveryIndex.Peer<BluetoothDevice> peer = probePeer;
        boolean publish = probeSucceeded && peer != null && peer.label.equals(probeLabel);
        String value = probeListing;
        probe = null; probePeer = null; probeClosing = false;
        probeLabel = null; probeListing = null; probeSucceeded = false;
        if (closing != null) { try { closing.close(); } catch (Exception ignored) {} }
        if (scanner != null && foreground && peers.contains(peer)) {
            if (publish) {
                if (peers.publish(peer, value, SystemClock.elapsedRealtime())) events.peer(peer.id, peer.label, value);
            } else if (peers.withdraw(peer)) events.peerLost(peer.id);
        }
        if (remote != null) connectSelected(); else pumpProbe();
    }
    private final BluetoothGattCallback probeCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt client, int status, int state) { run(() -> {
            if (client != probe) return;
            if (state == BluetoothProfile.STATE_DISCONNECTED) {
                if (!probeClosing) finishProbe(null, false);
                closedProbe(); return;
            }
            if (probeClosing) return;
            if (status != BluetoothGatt.GATT_SUCCESS) { finishProbe(null, false); return; }
            if (state == BluetoothProfile.STATE_CONNECTED) {
                try { if (!client.discoverServices()) finishProbe(null, false); }
                catch (Exception ignored) { finishProbe(null, false); }
            }
        }); }
        @Override public void onServicesDiscovered(BluetoothGatt client, int status) { run(() -> {
            if (client != probe || probeClosing) return;
            BluetoothGattService service = client.getService(SERVICE);
            BluetoothGattCharacteristic metadata = service == null ? null : service.getCharacteristic(META);
            if (status != BluetoothGatt.GATT_SUCCESS || metadata == null ||
                (metadata.getProperties() & BluetoothGattCharacteristic.PROPERTY_READ) == 0) { finishProbe(null, false); return; }
            try { if (!client.readCharacteristic(metadata)) finishProbe(null, false); }
            catch (Exception ignored) { finishProbe(null, false); }
        }); }
        @Override public void onCharacteristicRead(BluetoothGatt client, BluetoothGattCharacteristic characteristic, int status) {
            if (Build.VERSION.SDK_INT < 33) read(client, characteristic, characteristic.getValue(), status);
        }
        @Override public void onCharacteristicRead(BluetoothGatt client, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
            read(client, characteristic, value, status);
        }
        private void read(BluetoothGatt client, BluetoothGattCharacteristic characteristic, byte[] value, int status) {
            byte[] copy = value != null && value.length <= ListingPayload.MAX_BYTES ? value.clone() : null;
            run(() -> {
                if (client == probe && !probeClosing && META.equals(characteristic.getUuid()))
                    finishProbe(ListingPayload.decode(copy), status == BluetoothGatt.GATT_SUCCESS && copy != null &&
                        (copy.length == 0 || ListingPayload.decode(copy) != null));
            });
        }
    };
    private ScanCallback createScanCallback(long generation) { return new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            if (!scan.accepts(generation)) return;
            run(() -> {
            if (!scan.accepts(generation) || scanner == null || !foreground) return;
            BluetoothDevice device = result.getDevice();
            String name = result.getScanRecord() == null ? null : result.getScanRecord().getDeviceName();
            byte[] supplied = result.getScanRecord() == null ? null : result.getScanRecord().getServiceData(new ParcelUuid(SERVICE));
            if (supplied != null) name = DiscoveryLabel.fromBytes(supplied);
            if (!DiscoveryLabel.valid(name)) return;
            String key = device.getAddress();
            DiscoveryIndex.Peer<BluetoothDevice> previous = peers.byKey(key);
            boolean changed = previous == null || !previous.label.equals(name);
            if (changed && previous != null) {
                if (previous.announced) events.peerLost(previous.id);
                if (previous == probePeer) { probeSucceeded = false; releaseProbe(); }
            }
            DiscoveryIndex.Peer<BluetoothDevice> peer = peers.seen(key, device, name, SystemClock.elapsedRealtime());
            if (peer == null) return;
            if (!DiscoveryLabel.metadataCapable(peer.label) && peers.publish(peer, null, SystemClock.elapsedRealtime()))
                events.peer(peer.id, peer.label, null);
            pumpProbe();
        }); }
        @Override public void onScanFailed(int code) {
            if (!scan.accepts(generation)) return;
            run(() -> { if (scan.accepts(generation)) fail("scan-failed", "BLE scan failed: " + code); });
        }
    }; }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override public void onStartSuccess(AdvertiseSettings settings) { run(() -> events.status("BLE advertising started (60-second limit)")); }
        @Override public void onStartFailure(int errorCode) { run(() -> fail("advertise-failed", "BLE advertising failed: " + errorCode)); }
    };

    private final BluetoothGattCallback clientCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt client, int status, int state) { run(() -> {
            if (client != gatt) return;
            if (status != BluetoothGatt.GATT_SUCCESS || state == BluetoothProfile.STATE_DISCONNECTED) {
                fail("connection-lost", "BLE disconnected: " + status);
            } else if (state == BluetoothProfile.STATE_CONNECTED && !client.discoverServices()) {
                fail("discovery-failed", "Could not discover BLE service");
            }
        }); }
        @Override public void onServicesDiscovered(BluetoothGatt client, int status) { run(() -> {
            if (client != gatt) return;
            BluetoothGattService service = client.getService(SERVICE);
            if (status != BluetoothGatt.GATT_SUCCESS || service == null) { fail("service-missing", "Nearby BLE service unavailable"); return; }
            writeCharacteristic = service.getCharacteristic(RX);
            notifyCharacteristic = service.getCharacteristic(TX);
            if (writeCharacteristic == null || notifyCharacteristic == null ||
                (writeCharacteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE) == 0) {
                fail("service-missing", "Nearby BLE characteristics unavailable"); return;
            }
            BluetoothGattDescriptor descriptor = notifyCharacteristic.getDescriptor(CCC);
            int properties = notifyCharacteristic.getProperties();
            if (descriptor == null || (properties & (BluetoothGattCharacteristic.PROPERTY_NOTIFY | BluetoothGattCharacteristic.PROPERTY_INDICATE)) == 0 ||
                !client.setCharacteristicNotification(notifyCharacteristic, true)) {
                fail("subscribe-failed", "Could not enable BLE notifications"); return;
            }
            byte[] subscribe = (properties & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0
                ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE : BluetoothGattDescriptor.ENABLE_INDICATION_VALUE;
            earlyNotifications.begin();
            boolean accepted;
            if (Build.VERSION.SDK_INT >= 33) accepted = client.writeDescriptor(descriptor, subscribe) == BluetoothStatusCodes.SUCCESS;
            else { descriptor.setValue(subscribe); accepted = client.writeDescriptor(descriptor); }
            if (!accepted) fail("subscribe-failed", "BLE rejected subscription");
        }); }
        @Override public void onDescriptorWrite(BluetoothGatt client, BluetoothGattDescriptor descriptor, int status) { run(() -> {
            if (client != gatt || !CCC.equals(descriptor.getUuid())) return;
            if (status == BluetoothGatt.GATT_SUCCESS) connected();
            else fail("subscribe-failed", "BLE subscription failed: " + status);
        }); }
        @Override public void onCharacteristicWrite(BluetoothGatt client, BluetoothGattCharacteristic characteristic, int status) {
            run(() -> { if (client == gatt && RX.equals(characteristic.getUuid())) wrote(status); });
        }
        @Override public void onCharacteristicChanged(BluetoothGatt client, BluetoothGattCharacteristic characteristic) {
            if (Build.VERSION.SDK_INT < 33) incoming(client, characteristic, characteristic.getValue());
        }
        @Override public void onCharacteristicChanged(BluetoothGatt client, BluetoothGattCharacteristic characteristic, byte[] value) { incoming(client, characteristic, value); }
        private void incoming(BluetoothGatt client, BluetoothGattCharacteristic characteristic, byte[] value) {
            byte[] copy = value == null ? null : value.clone();
            run(() -> { if (client == gatt && TX.equals(characteristic.getUuid())) received(copy); });
        }
    };

    private final BluetoothGattServerCallback serverCallback = new BluetoothGattServerCallback() {
        @Override public void onServiceAdded(int status, BluetoothGattService service) { run(() -> {
            if (status != BluetoothGatt.GATT_SUCCESS) { fail("service-failed", "Could not add BLE service"); return; }
            AdvertiseData primary = new AdvertiseData.Builder().addServiceUuid(new ParcelUuid(SERVICE)).build();
            // A 128-bit UUID plus at most 8 label bytes fits a separate 31-byte scan response.
            AdvertiseData response = new AdvertiseData.Builder().addServiceData(new ParcelUuid(SERVICE),
                label.getBytes(StandardCharsets.US_ASCII)).build();
            advertiser.startAdvertising(new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setConnectable(true).setTimeout(0).build(), primary, response, advertiseCallback);
        }); }
        @Override public void onConnectionStateChange(BluetoothDevice device, int status, int state) { run(() -> {
            if (state == BluetoothProfile.STATE_CONNECTED) {
                if (status != BluetoothGatt.GATT_SUCCESS || !admission.connected(device)) {
                    server.cancelConnection(device); return;
                }
                if (device.equals(remote) || candidateTimeouts.containsKey(device)) return;
                Runnable timeout = () -> {
                    candidateTimeouts.remove(device);
                    admission.disconnected(device);
                    try { server.cancelConnection(device); } catch (Exception ignored) {}
                };
                candidateTimeouts.put(device, timeout);
                deadlines.post(timeout, 15_000);
            } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                Runnable timeout = candidateTimeouts.remove(device);
                if (timeout != null) deadlines.remove(timeout);
                if (admission.disconnected(device)) fail("connection-lost", "BLE peer disconnected");
            }
        }); }
        @Override public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int start,
            BluetoothGattCharacteristic characteristic) { run(() -> {
            if (!META.equals(characteristic.getUuid()) || !admission.candidate(device)) {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, start, null); return;
            }
            try {
                byte[] value = ListingPayload.read(remote == null ? listing : null, start);
                server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, start, value);
            } catch (IllegalArgumentException error) {
                server.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, start, null);
            }
        }); }
        @Override public void onCharacteristicWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattCharacteristic characteristic, boolean prepared, boolean responseNeeded, int start, byte[] value) {
            byte[] copy = value == null ? null : value.clone();
            run(() -> {
                boolean valid = device.equals(remote) && ready && RX.equals(characteristic.getUuid()) && !prepared && start == 0 &&
                    responseNeeded && copy != null && copy.length > 0 && copy.length <= 20;
                if (responseNeeded) server.sendResponse(device, requestId, valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
                if (valid) received(copy);
                else if (device.equals(remote)) fail("invalid-write", "Unsupported BLE write request");
            });
        }
        @Override public void onDescriptorWriteRequest(BluetoothDevice device, int requestId,
            BluetoothGattDescriptor descriptor, boolean prepared, boolean responseNeeded, int start, byte[] value) {
            byte[] copy = value == null ? null : value.clone();
            run(() -> {
                boolean subscription = Arrays.equals(copy, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) ||
                    Arrays.equals(copy, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE);
                boolean valid = CCC.equals(descriptor.getUuid()) && TX.equals(descriptor.getCharacteristic().getUuid()) &&
                    !prepared && responseNeeded && start == 0 && subscription && admission.subscribe(device);
                if (valid && remote == null) {
                    remote = device;
                    Runnable timeout = candidateTimeouts.remove(device);
                    if (timeout != null) deadlines.remove(timeout);
                    // Metadata readers do not own a seat; release any still connected
                    // when a participant explicitly subscribes to the game channel.
                    for (BluetoothDevice other : admission.waiting()) {
                        Runnable otherTimeout = candidateTimeouts.remove(other);
                        if (otherTimeout != null) deadlines.remove(otherTimeout);
                        admission.disconnected(other);
                        try { server.cancelConnection(other); } catch (Exception ignored) {}
                    }
                }
                if (responseNeeded) server.sendResponse(device, requestId, valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
                if (valid) { indicate = Arrays.equals(copy, BluetoothGattDescriptor.ENABLE_INDICATION_VALUE); connected(); }
                else if (device.equals(remote)) fail("subscribe-failed", "Unsupported BLE subscription or unsubscribe");
            });
        }
        @Override public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int start, BluetoothGattDescriptor descriptor) { run(() -> {
            boolean valid = (device.equals(remote) || admission.candidate(device)) && CCC.equals(descriptor.getUuid()) && start == 0;
            byte[] value = ready ? (indicate ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                : BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE;
            server.sendResponse(device, requestId, valid ? BluetoothGatt.GATT_SUCCESS : BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, valid ? value : null);
        }); }
        @Override public void onExecuteWrite(BluetoothDevice device, int requestId, boolean execute) { run(() -> {
            server.sendResponse(device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, 0, null);
            if (device.equals(remote)) fail("invalid-write", "Prepared writes are unsupported");
        }); }
        @Override public void onNotificationSent(BluetoothDevice device, int status) { run(() -> { if (device.equals(remote)) wrote(status); }); }
    };

    private void fail(String code, String message) { if (!active) return; stop(); events.failed(code, message); }
    private void stopScan() {
        deadlines.remove(maintenance);
        scan.stop();
        scanner = null;
    }
    private void stopAdvertising() {
        if (advertiser != null) { try { advertiser.stopAdvertising(advertiseCallback); } catch (Exception ignored) {} }
    }
    public void setForeground(boolean active) {
        if (foreground == active) return;
        foreground = active;
        deadlines.setActive(active);
        if (scanner != null) {
            if (!active) {
                // Keep the connection/session, but never discover devices in the background.
                // Android 10/11 would otherwise require background location for BLE scanning.
                scan.setForeground(false);
                probeSucceeded = false;
                releaseProbe();
            }
            else {
                // Cached rows are not evidence that a host is still open after suspension.
                for (DiscoveryIndex.Peer<BluetoothDevice> peer : peers.clear()) if (peer.announced) events.peerLost(peer.id);
                try { scan.setForeground(true); }
                catch (RuntimeException error) { fail("scan-failed", "BLE discovery could not resume"); return; }
                deadlines.post(maintenance, 1_000);
            }
        }
    }

    public void stop() {
        active = false; ready = false; writing = false;
        if (observingAdapter) {
            observingAdapter = false;
            try { context.unregisterReceiver(adapterState); } catch (Exception ignored) {}
        }
        deadlines.clear();
        main.removeCallbacksAndMessages(null);
        stopScan(); stopAdvertising(); advertiser = null;
        if (probe != null) { try { probe.disconnect(); probe.close(); } catch (Exception ignored) {} probe = null; }
        probePeer = null; probeClosing = false;
        if (server != null) for (BluetoothDevice device : admission.waiting()) {
            try { server.cancelConnection(device); } catch (Exception ignored) {}
        }
        admission.clear(); candidateTimeouts.clear();
        if (gatt != null) { try { gatt.disconnect(); gatt.close(); } catch (Exception ignored) {} gatt = null; }
        if (server != null) { try { if (remote != null) server.cancelConnection(remote); server.close(); } catch (Exception ignored) {} server = null; }
        remote = null; frames.clear(); peers.clear(); decoder.clear(); earlyNotifications.clear(); offset = 0;
    }
}
