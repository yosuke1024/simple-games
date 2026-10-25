package com.pixapps.simplegames.nearby;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayDeque;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicBoolean;

/** Existing Wi-Fi + DNS-SD + TCP; no network request, Internet server, or arbitrary-address API. */
@SuppressWarnings("deprecation") // resolveService and all-network discovery are needed on API 24–32.
final class LanTransport implements Transport {
    private static final String TYPE = NsdServiceType.NEARBY;
    private final Context context;
    private final Events events;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final PausableDeadlines deadlines = new PausableDeadlines(new PausableDeadlines.Scheduler() {
        public void post(Runnable callback, long delay) { main.postDelayed(callback, delay); }
        public void remove(Runnable callback) { main.removeCallbacks(callback); }
    });
    private final DiscoveryIndex<NsdServiceInfo> peers = new DiscoveryIndex<>("lan-");
    private DiscoveryIndex.Peer<NsdServiceInfo> selected;
    private NsdManager.ResolveListener pendingResolution;
    private Runnable resolutionTimeout;
    private boolean foreground = true;
    private byte[] listing;
    private final Runnable maintenance = this::maintainDiscovery;
    private final ArrayDeque<byte[]> frames = new ArrayDeque<>();
    private final AtomicInteger inbound = new AtomicInteger();
    private final AtomicInteger pendingCallbacks = new AtomicInteger();
    private final AtomicBoolean callbackOverflow = new AtomicBoolean();
    private final ThreadPoolExecutor writer = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(1), task -> new Thread(task, "nearby-lan-writer"));
    private volatile boolean active;
    private volatile Socket socket;
    private volatile ServerSocket listener;
    private Network wifi;
    private ConnectivityManager connectivity;
    private boolean observingWifi;
    private LinkProperties links;
    private NsdManager nsd;
    private boolean advertising;
    private boolean discovering;
    private boolean registering;
    private boolean ready;
    private boolean writing;
    private String label;
    private String chosenName;
    private final Runnable discoveryTimeout = () -> fail("discovery-timeout", "Discovery ended after 60 seconds; start again to retry");
    private final Runnable connectTimeout = () -> fail("connect-timeout", "LAN resolve or connection timed out");
    private final Runnable writeTimeout = () -> fail("write-timeout", "LAN write timed out");
    private final Runnable receiveTimeout = () -> fail("frame-timeout", "Incomplete LAN frame timed out");
    private final ConnectivityManager.NetworkCallback networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override public void onLost(Network network) {
            run(() -> { if (network.equals(wifi)) fail("wifi-lost", "The selected Wi-Fi connection was lost"); });
        }
    };

    LanTransport(Context context, Events events) { this.context = context; this.events = events; }

    public void start(boolean advertise, String label, byte[] listing) throws Exception {
        connectivity = context.getSystemService(ConnectivityManager.class);
        nsd = context.getSystemService(NsdManager.class);
        if (connectivity == null || nsd == null) throw new IllegalStateException("LAN services unavailable");
        for (Network network : connectivity.getAllNetworks()) {
            NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
            if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                LinkProperties properties = connectivity.getLinkProperties(network);
                if (properties != null && ipv4(properties) != null) { wifi = network; links = properties; break; }
            }
        }
        if (wifi == null) throw new IllegalStateException("Join the same Wi-Fi LAN first (IPv4 required)");
        this.advertising = advertise;
        this.label = "NP-" + label;
        this.listing = listing;
        active = true;
        connectivity.registerNetworkCallback(new NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build(), networkCallback);
        observingWifi = true;
        deadlines.post(discoveryTimeout, 60_000);
        if (advertise) startListener();
        else {
            discovering = true;
            if (Build.VERSION.SDK_INT >= 33) nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, wifi, main::post, discovery);
            else nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, discovery);
            events.status("Wi-Fi LAN discovery started (60-second limit)");
            deadlines.post(maintenance, 1_000);
        }
    }

    private static InetAddress ipv4(LinkProperties properties) {
        for (LinkAddress address : properties.getLinkAddresses()) {
            if (address.getAddress() instanceof Inet4Address && !address.getAddress().isLoopbackAddress()) return address.getAddress();
        }
        return null;
    }

    private void startListener() {
        new Thread(() -> {
            try {
                ServerSocket created = new ServerSocket();
                synchronized (this) {
                    if (!active) { created.close(); return; }
                    listener = created;
                }
                // Bind exactly the current Wi-Fi interface, never 0.0.0.0/cellular.
                created.bind(new InetSocketAddress(ipv4(links), 0), 1);
                // The pausable discovery deadline closes this blocking accept on expiry.
                created.setSoTimeout(0);
                run(() -> {
                    NsdServiceInfo info = new NsdServiceInfo();
                    info.setServiceName(label); info.setServiceType(TYPE); info.setPort(created.getLocalPort());
                    if (listing != null) info.setAttribute("listing", ListingPayload.decode(listing));
                    if (Build.VERSION.SDK_INT >= 33) info.setNetwork(wifi);
                    registering = true;
                    nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration);
                });
                Socket accepted = created.accept();
                created.close();
                if (!sameSubnet(accepted.getInetAddress())) { accepted.close(); throw new IllegalStateException("Peer is not on the selected Wi-Fi subnet"); }
                if (!adopt(accepted)) return;
                read(accepted);
            } catch (Exception e) { run(() -> fail("listen-failed", "LAN listener stopped: " + e.getClass().getSimpleName())); }
        }, "nearby-lan-listener").start();
    }

    public void connect(String peerId) {
        if (!active || advertising || selected != null || socket != null) throw new IllegalStateException("LAN is not available for another connection");
        DiscoveryIndex.Peer<NsdServiceInfo> peer = peers.byId(peerId);
        if (peer == null || !peer.announced) throw new IllegalArgumentException("Select a current discovered LAN peer");
        selected = peer;
        chosenName = peer.value.getServiceName();
        deadlines.remove(discoveryTimeout);
        stopDiscovery();
        deadlines.post(connectTimeout, 15_000);
        // API 24-33 cannot cancel resolveService. Finish the one bounded metadata
        // request before resolving the user's choice; never overlap NSD resolves.
        if (pendingResolution == null) resolve(peer);
    }

    private void maintainDiscovery() {
        if (!active || !discovering || !foreground) return;
        // NSD does not repeat onServiceFound like BLE advertisements. Retain the
        // bounded candidate until onServiceLost, but withdraw unverified metadata
        // after 15 seconds so an old name is not kept visible indefinitely.
        for (DiscoveryIndex.Peer<NsdServiceInfo> peer : peers.expireListings(SystemClock.elapsedRealtime()))
            events.peerLost(peer.id);
        pumpResolution();
        deadlines.post(maintenance, 1_000);
    }
    private void pumpResolution() {
        if (!active || pendingResolution != null) return;
        if (selected != null) { resolve(selected); return; }
        if (!discovering || !foreground) return;
        DiscoveryIndex.Peer<NsdServiceInfo> peer = peers.nextProbe(SystemClock.elapsedRealtime());
        if (peer != null) resolve(peer);
    }
    private void updateListing(DiscoveryIndex.Peer<NsdServiceInfo> peer, String value, boolean succeeded) {
        if (succeeded) {
            if (peers.publish(peer, value, SystemClock.elapsedRealtime())) events.peer(peer.id, peer.label, value);
        } else if (peers.withdraw(peer)) events.peerLost(peer.id);
    }
    private void resolve(DiscoveryIndex.Peer<NsdServiceInfo> peer) {
        final class Resolution implements NsdManager.ResolveListener {
            private boolean expired;
            private final Runnable timeout = () -> {
                if (pendingResolution != this) return;
                expired = true;
                updateListing(peer, null, false);
                if (Build.VERSION.SDK_INT >= 34) {
                    try { nsd.stopServiceResolution(this); } catch (Exception ignored) { /* Keep the single in-flight slot until its callback. */ }
                }
                // No retry loop while an older Android resolver still owns its slot.
                // The overall discovery/connect deadline remains independently bounded.
            };
            private boolean finish() {
                if (pendingResolution != this) return false;
                deadlines.remove(timeout); pendingResolution = null; resolutionTimeout = null; return true;
            }
            public void onResolveFailed(NsdServiceInfo info, int code) { run(() -> {
                if (!finish()) return;
                updateListing(peer, null, false);
                if (selected == peer) fail("resolve-failed", "LAN resolution failed: " + code);
                else pumpResolution();
            }); }
            public void onResolutionStopped(NsdServiceInfo info) { run(() -> { if (finish()) pumpResolution(); }); }
            public void onStopResolutionFailed(NsdServiceInfo info, int code) { /* Original resolution still owns the slot. */ }
            public void onServiceResolved(NsdServiceInfo info) { run(() -> {
                if (!finish()) return;
                if (expired) { pumpResolution(); return; }
                boolean matching = peer.value.getServiceName().equals(info.getServiceName()) &&
                    TYPE.equals(NsdServiceType.normalize(info.getServiceType())) &&
                    (Build.VERSION.SDK_INT < 33 || info.getNetwork() == null || wifi.equals(info.getNetwork()));
                if (matching && peers.contains(peer)) {
                    peer.lastSeen = SystemClock.elapsedRealtime();
                    byte[] raw = info.getAttributes().get("listing");
                    String value = ListingPayload.decode(raw);
                    updateListing(peer, value, raw == null || value != null);
                } else updateListing(peer, null, false);
                if (selected == peer) connectResolved(info);
                else pumpResolution();
            }); }
        }
        Resolution attempt = new Resolution();
        pendingResolution = attempt;
        resolutionTimeout = attempt.timeout;
        deadlines.post(resolutionTimeout, 5_000);
        try { nsd.resolveService(peer.value, attempt); }
        catch (Exception error) {
            deadlines.remove(resolutionTimeout); pendingResolution = null; resolutionTimeout = null;
            updateListing(peer, null, false);
            if (selected == peer) fail("resolve-failed", "LAN resolution could not start");
            // The maintenance tick advances remaining discovery candidates.
        }
    }

    private final NsdManager.DiscoveryListener discovery = new NsdManager.DiscoveryListener() {
        public void onDiscoveryStarted(String type) { main.post(() -> {
            if (!active) { try { nsd.stopServiceDiscovery(discovery); } catch (Exception ignored) {} }
        }); }
        public void onDiscoveryStopped(String type) {}
        public void onStartDiscoveryFailed(String type, int code) { run(() -> fail("discovery-failed", "LAN discovery failed: " + code)); }
        public void onStopDiscoveryFailed(String type, int code) { run(() -> fail("discovery-stop-failed", "LAN discovery could not stop: " + code)); }
        public void onServiceFound(NsdServiceInfo info) { run(() -> {
            String label = DiscoveryLabel.fromServiceName(info.getServiceName());
            if (!discovering || !TYPE.equals(NsdServiceType.normalize(info.getServiceType())) || label == null) return;
            if (Build.VERSION.SDK_INT >= 33 && info.getNetwork() != null && !wifi.equals(info.getNetwork())) return;
            DiscoveryIndex.Peer<NsdServiceInfo> peer = peers.seen(info.getServiceName(), info, label, SystemClock.elapsedRealtime());
            if (peer == null) return;
            if (!DiscoveryLabel.metadataCapable(peer.label) && peers.publish(peer, null, SystemClock.elapsedRealtime()))
                events.peer(peer.id, peer.label, null);
            pumpResolution();
        }); }
        public void onServiceLost(NsdServiceInfo info) { run(() -> {
            if (!discovering) return;
            DiscoveryIndex.Peer<NsdServiceInfo> lost = peers.remove(info.getServiceName());
            if (lost != null && lost.announced) events.peerLost(lost.id);
        }); }
    };

    private final NsdManager.RegistrationListener registration = new NsdManager.RegistrationListener() {
        public void onServiceRegistered(NsdServiceInfo info) {
            // An asynchronous registration can complete after stop; unregister that exact listener.
            main.post(() -> {
                if (!active) { unregister(); return; }
                events.status("LAN advertised as " + info.getServiceName() + " (60-second limit)");
            });
        }
        public void onRegistrationFailed(NsdServiceInfo info, int code) { run(() -> fail("advertise-failed", "LAN registration failed: " + code)); }
        public void onServiceUnregistered(NsdServiceInfo info) {}
        public void onUnregistrationFailed(NsdServiceInfo info, int code) { run(() -> fail("unregister-failed", "LAN unregister failed: " + code)); }
    };

    private void connectResolved(NsdServiceInfo info) {
            if (!chosenName.equals(info.getServiceName())) {
                fail("invalid-peer", "Resolved service name no longer matches the selected peer"); return;
            }
            if (!TYPE.equals(NsdServiceType.normalize(info.getServiceType()))) {
                fail("invalid-peer", "Resolved service type does not match Nearby LAN"); return;
            }
            if (info.getPort() < 1 || info.getPort() > 65535) {
                fail("invalid-peer", "Resolved peer has an invalid TCP port"); return;
            }
            if (Build.VERSION.SDK_INT >= 33 && info.getNetwork() != null && !wifi.equals(info.getNetwork())) {
                fail("invalid-peer", "Resolved peer belongs to a different network"); return;
            }
            InetAddress host = info.getHost();
            if (Build.VERSION.SDK_INT >= 34) {
                for (InetAddress candidate : info.getHostAddresses()) {
                    if (candidate instanceof Inet4Address && sameSubnet(candidate)) { host = candidate; break; }
                }
            }
            if (host == null) {
                fail("invalid-peer", "Resolved peer has no host address"); return;
            }
            if (!(host instanceof Inet4Address)) {
                fail("invalid-peer", "Resolved peer has no usable IPv4 address"); return;
            }
            if (!sameSubnet(host)) {
                fail("invalid-peer", "Resolved peer is outside the selected Wi-Fi subnet"); return;
            }
            InetAddress resolvedHost = host;
            new Thread(() -> {
                try {
                    Socket created = new Socket();
                    synchronized (LanTransport.this) {
                        if (!active) { created.close(); return; }
                        socket = created; // stop can close a pending connect.
                    }
                    wifi.bindSocket(created);
                    created.connect(new InetSocketAddress(resolvedHost, info.getPort()), 8_000);
                    if (!adopt(created)) return;
                    read(created);
                } catch (Exception e) { run(() -> fail("connect-failed", "LAN connection failed: " + e.getClass().getSimpleName())); }
            }, "nearby-lan-reader").start();
    }

    private boolean sameSubnet(InetAddress remote) {
        if (remote.isAnyLocalAddress() || remote.isLoopbackAddress() || remote.isMulticastAddress()) return false;
        byte[] candidate = remote.getAddress();
        for (LinkAddress link : links.getLinkAddresses()) {
            byte[] local = link.getAddress().getAddress();
            if (local.length != candidate.length) continue;
            boolean same = true;
            int prefix = link.getPrefixLength();
            for (int i = 0; i < local.length && prefix > 0; i++, prefix -= 8) {
                int mask = 0xff << (8 - Math.min(prefix, 8));
                if ((local[i] & mask) != (candidate[i] & mask)) { same = false; break; }
            }
            if (same) return true;
        }
        return false;
    }

    private boolean adopt(Socket connected) throws Exception {
        connected.setTcpNoDelay(true);
        connected.setSoTimeout(0); // A player can think indefinitely. stop() closes and unblocks this socket.
        synchronized (this) {
            if (!active) { connected.close(); return false; }
            socket = connected;
        }
        run(() -> {
            ready = true;
            deadlines.remove(discoveryTimeout); deadlines.remove(connectTimeout);
            stopDiscovery(); unregister(); events.connected();
        });
        return true;
    }

    private void read(Socket connected) throws Exception {
        FrameCodec decoder = new FrameCodec();
        InputStream input = connected.getInputStream();
        byte[] buffer = new byte[1024];
        while (active && connected == socket) {
            int length = input.read(buffer);
            if (length == -1) { run(() -> events.disconnected("LAN peer closed the connection")); return; }
            decoder.accept(buffer, length, text -> {
                if (inbound.incrementAndGet() > 16) throw new IllegalStateException("Incoming frame queue overflow");
                main.post(() -> {
                    try { if (active) events.data(text); }
                    finally { inbound.decrementAndGet(); }
                });
            });
            boolean partial = decoder.hasPartialFrame();
            run(() -> {
                deadlines.remove(receiveTimeout);
                if (partial) deadlines.post(receiveTimeout, 5_000);
            });
        }
    }

    public void send(byte[] frame) {
        if (!active || !ready || socket == null) throw new IllegalStateException("LAN is not connected");
        if (frames.size() >= 16) throw new IllegalStateException("LAN send queue is full (16 frames)");
        frames.add(frame); pump();
    }

    private void pump() {
        if (!active || !ready || writing || frames.isEmpty()) return;
        writing = true;
        Socket target = socket;
        byte[] frame = frames.peek();
        deadlines.post(writeTimeout, 5_000);
        writer.execute(() -> {
            try {
                target.getOutputStream().write(frame); target.getOutputStream().flush();
                run(() -> {
                    deadlines.remove(writeTimeout);
                    frames.remove(); writing = false; pump();
                });
            } catch (Exception e) { run(() -> fail("write-failed", "LAN write failed")); }
        });
    }

    private void run(Runnable action) {
        if (!active) return;
        if (pendingCallbacks.incrementAndGet() > 64) {
            pendingCallbacks.decrementAndGet();
            if (callbackOverflow.compareAndSet(false, true)) main.post(() -> fail("receive-overflow", "LAN callback queue overflow"));
            return;
        }
        main.post(() -> {
            try { if (active) action.run(); }
            catch (Exception e) { fail("lan-error", "LAN operation failed: " + e.getClass().getSimpleName()); }
            finally { pendingCallbacks.decrementAndGet(); }
        });
    }
    private void fail(String code, String message) { if (!active) return; stop(); events.failed(code, message); }
    private void stopDiscovery() {
        deadlines.remove(maintenance);
        if (discovering) { discovering = false; try { nsd.stopServiceDiscovery(discovery); } catch (Exception ignored) {} }
    }
    private void unregister() {
        if (registering) { try { nsd.unregisterService(registration); } catch (Exception ignored) {} }
        // Keep the flag for the late onServiceRegistered cleanup; unregister is idempotently guarded by Android.
    }
    public void setForeground(boolean active) {
        foreground = active;
        deadlines.setActive(active);
        if (active && discovering) {
            for (DiscoveryIndex.Peer<NsdServiceInfo> peer : peers.revalidate(SystemClock.elapsedRealtime()))
                events.peerLost(peer.id);
            deadlines.post(maintenance, 1_000);
        }
    }

    public void stop() {
        synchronized (this) {
            active = false;
            if (listener != null) { try { listener.close(); } catch (Exception ignored) {} listener = null; }
            if (socket != null) { try { socket.close(); } catch (Exception ignored) {} socket = null; }
        }
        ready = false; writing = false;
        if (observingWifi) {
            observingWifi = false;
            try { connectivity.unregisterNetworkCallback(networkCallback); } catch (Exception ignored) {}
        }
        deadlines.clear();
        main.removeCallbacksAndMessages(null);
        stopDiscovery(); unregister();
        if (pendingResolution != null && Build.VERSION.SDK_INT >= 34) { try { nsd.stopServiceResolution(pendingResolution); } catch (Exception ignored) {} }
        pendingResolution = null; resolutionTimeout = null; selected = null;
        writer.shutdownNow(); frames.clear(); peers.clear();
    }
}
