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
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
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
    private final boolean multiHost;
    private final PeerLinks<Channel> channels = new PeerLinks<>();
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
    private final List<ServerSocket> listeners = new ArrayList<>();
    private Network wifi;
    private ConnectivityManager connectivity;
    private boolean observingWifi;
    private LinkProperties links;
    private List<LanAddressPolicy.Link> localLinks;
    private List<InetAddress> localAddresses;
    private int interfaceIndex;
    private NsdManager nsd;
    private boolean advertising;
    private boolean discovering;
    private boolean registering;
    private int advertisedPort;
    // Multi-seat host only. NsdManager cannot update a TXT record in place, so a change in whether
    // the room is listed is an unregister followed by a register of the same name and port.
    private HostRegistration hostRegistration;
    private boolean announced;
    private final ListingRegistration registrations = new ListingRegistration(new ListingRegistration.Driver() {
        public void register(boolean listed) {
            HostRegistration next = new HostRegistration();
            hostRegistration = next;
            nsd.registerService(serviceInfo(listed), NsdManager.PROTOCOL_DNS_SD, next);
        }
        public void unregister() { nsd.unregisterService(hostRegistration); }
    });
    private boolean ready;
    private boolean writing;
    private Runnable drained;
    private final Runnable drainTimeout = this::finishDrain;
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
        @Override public void onLinkPropertiesChanged(Network network, LinkProperties properties) {
            run(() -> {
                if (network.equals(wifi) && (!Objects.equals(links.getInterfaceName(), properties.getInterfaceName()) ||
                    !LanAddressPolicy.sameLinks(localLinks, addresses(properties)))) {
                    fail("wifi-changed", "The selected Wi-Fi addressing changed; reconnect to continue");
                }
            });
        }
    };

    LanTransport(Context context, Events events) { this(context, events, false); }
    LanTransport(Context context, Events events, boolean multiHost) {
        this.context = context; this.events = events; this.multiHost = multiHost;
    }

    public void start(boolean advertise, String label, byte[] listing) throws Exception {
        connectivity = context.getSystemService(ConnectivityManager.class);
        nsd = context.getSystemService(NsdManager.class);
        if (connectivity == null || nsd == null) throw new IllegalStateException("LAN services unavailable");
        for (Network network : connectivity.getAllNetworks()) {
            NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
            if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
                !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                LinkProperties properties = connectivity.getLinkProperties(network);
                if (properties == null) continue;
                NetworkInterface networkInterface = properties.getInterfaceName() == null ? null :
                    NetworkInterface.getByName(properties.getInterfaceName());
                int index = networkInterface == null ? 0 : networkInterface.getIndex();
                List<LanAddressPolicy.Link> candidateLinks = addresses(properties);
                List<InetAddress> candidates = LanAddressPolicy.localAddresses(candidateLinks, index);
                if (!candidates.isEmpty()) {
                    wifi = network; links = properties; localLinks = candidateLinks;
                    localAddresses = candidates; interfaceIndex = index; break;
                }
            }
        }
        if (wifi == null) throw new IllegalStateException("Join the same Wi-Fi LAN first");
        this.advertising = advertise;
        this.label = "NP-" + label;
        this.listing = listing;
        active = true;
        connectivity.registerNetworkCallback(new NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI).build(), networkCallback);
        observingWifi = true;
        if (!multiHost) deadlines.post(discoveryTimeout, 60_000);
        if (advertise) startListener();
        else {
            discovering = true;
            if (Build.VERSION.SDK_INT >= 33) nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, wifi, main::post, discovery);
            else nsd.discoverServices(TYPE, NsdManager.PROTOCOL_DNS_SD, discovery);
            events.status("Wi-Fi LAN discovery started (60-second limit)");
            deadlines.post(maintenance, 1_000);
        }
    }

    private static List<LanAddressPolicy.Link> addresses(LinkProperties properties) {
        List<LanAddressPolicy.Link> result = new ArrayList<>();
        for (LinkAddress address : properties.getLinkAddresses()) {
            result.add(new LanAddressPolicy.Link(address.getAddress(), address.getPrefixLength()));
        }
        return result;
    }

    private void startListener() {
        new Thread(() -> {
            try {
                List<ServerSocket> bound = new ArrayList<>();
                int port = 0;
                for (InetAddress address : localAddresses) {
                    ServerSocket created = new ServerSocket();
                    synchronized (this) {
                        if (!active) { created.close(); return; }
                        listeners.add(created);
                    }
                    // DNS-SD may advertise every address on this Wi-Fi link. Bind each
                    // concrete address to one shared port; never bind a wildcard/cellular address.
                    created.bind(new InetSocketAddress(address, port), multiHost ? PeerLinks.CAPACITY : 1);
                    if (port == 0) port = created.getLocalPort();
                    created.setSoTimeout(0); // stop/deadline closes every blocking accept.
                    bound.add(created);
                }
                final int boundPort = port;
                run(() -> {
                    advertisedPort = boundPort;
                    registering = true;
                    // A multi-seat host may already have asked to be hidden; its first registration honours that.
                    if (multiHost) registrations.open();
                    else nsd.registerService(serviceInfo(true), NsdManager.PROTOCOL_DNS_SD, registration);
                });
                for (ServerSocket created : bound) {
                    new Thread(() -> accept(created), "nearby-lan-accept").start();
                }
            } catch (Exception e) { run(() -> fail("listen-failed", "LAN listener stopped: " + e.getClass().getSimpleName())); }
        }, "nearby-lan-listener").start();
    }

    private NsdServiceInfo serviceInfo(boolean listed) {
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(label); info.setServiceType(TYPE); info.setPort(advertisedPort);
        // A hidden room omits the item (never an empty value); see ListingPayload.txtListing.
        String txtListing = ListingPayload.txtListing(listing, listed);
        if (txtListing != null) info.setAttribute("listing", txtListing);
        if (Build.VERSION.SDK_INT >= 33) info.setNetwork(wifi);
        return info;
    }

    private void accept(ServerSocket source) {
        if (multiHost) { acceptMany(source); return; }
        Socket accepted = null;
        try {
            accepted = source.accept();
            if (!sameSubnet(accepted.getInetAddress())) {
                accepted.close();
                throw new IllegalStateException("Peer is not on the selected Wi-Fi subnet");
            }
            synchronized (this) {
                if (!active || socket != null) { accepted.close(); return; }
                socket = accepted; // Exactly one listener wins, even when both IP families connect together.
                closeListeners();
            }
            if (!adopt(accepted)) return;
            read(accepted);
        } catch (Exception error) {
            Socket failed = accepted;
            run(() -> {
                // Closing the other listeners after one connection is expected, not a disconnection.
                if (socket == null || socket == failed) fail("listen-failed", "LAN listener stopped: " + error.getClass().getSimpleName());
            });
        }
    }

    /** Each accepted guest owns its decoder, bounded queue, writer, and progress deadlines. */
    private final class Channel {
        final Socket socket;
        final FrameCodec decoder = new FrameCodec();
        final ArrayDeque<byte[]> frames = new ArrayDeque<>();
        final AtomicInteger callbacks = new AtomicInteger();
        final AtomicBoolean overflow = new AtomicBoolean();
        final ThreadPoolExecutor writer = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(1), task -> new Thread(task, "nearby-lan-peer-writer"));
        final Runnable writeTimeout = () -> closeChannel(this, "LAN write timed out");
        final Runnable receiveTimeout = () -> closeChannel(this, "Incomplete LAN frame timed out");
        final Runnable drainTimeout = () -> closeChannel(this, "disconnected");
        String id;
        boolean writing;
        boolean closing;
        Channel(Socket socket) { this.socket = socket; }
        boolean current() { return active && channels.get(id) == this; }
        void close() {
            try { socket.close(); } catch (Exception ignored) {}
            deadlines.remove(writeTimeout); deadlines.remove(receiveTimeout); deadlines.remove(drainTimeout);
            writer.shutdownNow(); frames.clear(); decoder.clear();
        }
    }

    private void acceptMany(ServerSocket source) {
        while (active && !source.isClosed()) {
            Socket accepted;
            try { accepted = source.accept(); }
            catch (IOException error) {
                run(() -> fail("listen-failed", "LAN listener stopped")); return;
            }
            try {
                if (!sameSubnet(accepted.getInetAddress())) { accepted.close(); continue; }
                accepted.setTcpNoDelay(true); accepted.setSoTimeout(0);
                Channel channel = new Channel(accepted);
                synchronized (this) {
                    if (!active || (channel.id = channels.add(channel)) == null) {
                        accepted.close(); continue;
                    }
                }
                postChannel(channel, () -> events.connected(channel.id));
                new Thread(() -> readChannel(channel), "nearby-lan-peer-reader").start();
            } catch (Exception error) {
                // A rejected guest does not tear down listeners or the other accepted guests.
                try { accepted.close(); } catch (Exception ignored) {}
            }
        }
    }

    private void readChannel(Channel channel) {
        try {
            InputStream input = channel.socket.getInputStream();
            byte[] buffer = new byte[1024];
            while (channel.current()) {
                int length = input.read(buffer);
                if (length == -1) break;
                // Decode on main with the send queue and deadlines, never share a decoder.
                byte[] value = java.util.Arrays.copyOf(buffer, length);
                postChannel(channel, () -> {
                    channel.decoder.accept(value, value.length, text -> events.data(channel.id, text));
                    deadlines.remove(channel.receiveTimeout);
                    if (channel.decoder.hasPartialFrame()) deadlines.post(channel.receiveTimeout, 5_000);
                });
            }
            postChannel(channel, () -> closeChannel(channel, "LAN peer closed the connection"));
        } catch (Exception error) {
            postChannel(channel, () -> closeChannel(channel, "LAN peer connection lost"));
        }
    }

    private interface ChannelAction { void run() throws Exception; }
    private void postChannel(Channel channel, ChannelAction action) {
        if (!channel.current()) return;
        if (channel.callbacks.incrementAndGet() > 32) {
            channel.callbacks.decrementAndGet();
            if (channel.overflow.compareAndSet(false, true))
                main.post(() -> closeChannel(channel, "LAN peer receive queue overflow"));
            return;
        }
        main.post(() -> {
            try { if (channel.current()) action.run(); }
            catch (Exception error) { closeChannel(channel, "Malformed LAN peer frame"); }
            finally { channel.callbacks.decrementAndGet(); }
        });
    }

    public void send(byte[] frame, String peerId) {
        if (!multiHost) {
            if (peerId != null) throw new IllegalArgumentException("Targeted sends require multi-peer mode");
            send(frame); return;
        }
        Channel channel = channels.get(peerId);
        if (channel == null || !channel.current() || channel.closing) throw new IllegalStateException("LAN peer is not connected");
        if (channel.frames.size() >= 16) throw new IllegalStateException("LAN peer send queue is full (16 frames)");
        channel.frames.add(frame); pumpChannel(channel);
    }

    private void pumpChannel(Channel channel) {
        if (channel.current() && channel.closing && !channel.writing && channel.frames.isEmpty()) {
            closeChannel(channel, "disconnected"); return;
        }
        if (!channel.current() || channel.writing || channel.frames.isEmpty()) return;
        channel.writing = true;
        byte[] frame = channel.frames.peek();
        deadlines.post(channel.writeTimeout, 5_000);
        channel.writer.execute(() -> {
            try {
                channel.socket.getOutputStream().write(frame); channel.socket.getOutputStream().flush();
                postChannel(channel, () -> {
                    deadlines.remove(channel.writeTimeout);
                    channel.frames.remove(); channel.writing = false; pumpChannel(channel);
                });
            } catch (Exception error) { postChannel(channel, () -> closeChannel(channel, "LAN peer write failed")); }
        });
    }

    public void disconnect(String peerId) {
        if (!multiHost || peerId == null) throw new IllegalArgumentException("Targeted disconnect requires a peerId and multi-peer mode");
        Channel channel = channels.get(peerId);
        if (channel != null && !channel.closing) {
            channel.closing = true;
            deadlines.post(channel.drainTimeout, 5_000);
            pumpChannel(channel);
        }
    }

    private void closeChannel(Channel channel, String reason) {
        if (channels.get(channel.id) != channel) return;
        channels.remove(channel.id); channel.close();
        if (active) events.disconnected(channel.id, reason);
    }

    private synchronized void closeListeners() {
        for (ServerSocket listener : listeners) { try { listener.close(); } catch (Exception ignored) {} }
        listeners.clear();
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
                events.status("LAN advertised as " + info.getServiceName() + (multiHost ? "" : " (60-second limit)"));
            });
        }
        public void onRegistrationFailed(NsdServiceInfo info, int code) { run(() -> fail("advertise-failed", "LAN registration failed: " + code)); }
        public void onServiceUnregistered(NsdServiceInfo info) {}
        public void onUnregistrationFailed(NsdServiceInfo info, int code) { run(() -> fail("unregister-failed", "LAN unregister failed: " + code)); }
    };

    /** One per multi-seat registration, so a late callback of an older one is recognised and dropped. */
    private final class HostRegistration implements NsdManager.RegistrationListener {
        public void onServiceRegistered(NsdServiceInfo info) { main.post(() -> {
            if (!active) { try { nsd.unregisterService(this); } catch (Exception ignored) {} return; }
            if (hostRegistration != this) return;
            try {
                if (!announced) { announced = true; events.status("LAN advertised as " + info.getServiceName()); }
                registrations.registered();
            } catch (Exception error) { fail("lan-error", "LAN operation failed: " + error.getClass().getSimpleName()); }
        }); }
        public void onRegistrationFailed(NsdServiceInfo info, int code) { run(() -> {
            if (hostRegistration == this) fail("advertise-failed", "LAN registration failed: " + code);
        }); }
        public void onServiceUnregistered(NsdServiceInfo info) { main.post(() -> {
            if (!active || hostRegistration != this) return;
            try { registrations.unregistered(); }
            catch (Exception error) { fail("lan-error", "LAN operation failed: " + error.getClass().getSimpleName()); }
        }); }
        public void onUnregistrationFailed(NsdServiceInfo info, int code) { run(() -> {
            if (hostRegistration == this) fail("unregister-failed", "LAN unregister failed: " + code);
        }); }
    }

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
            List<InetAddress> resolved = Build.VERSION.SDK_INT >= 34 ? info.getHostAddresses() :
                (info.getHost() == null ? Collections.emptyList() : Collections.singletonList(info.getHost()));
            if (resolved.isEmpty()) {
                fail("invalid-peer", "Resolved peer has no host address"); return;
            }
            List<InetAddress> candidates = LanAddressPolicy.remoteAddresses(resolved, localLinks, interfaceIndex);
            if (candidates.isEmpty()) {
                fail("invalid-peer", "Resolved peer is outside the selected Wi-Fi subnet"); return;
            }
            new Thread(() -> {
                try {
                    Socket created = connectCandidates(candidates, info.getPort());
                    if (created == null) return;
                    if (!adopt(created)) return;
                    read(created);
                } catch (Exception e) { run(() -> fail("connect-failed", "LAN connection failed: " + e.getClass().getSimpleName())); }
            }, "nearby-lan-reader").start();
    }

    private Socket connectCandidates(List<InetAddress> candidates, int port) throws IOException {
        long end = SystemClock.elapsedRealtime() + 8_000;
        IOException last = new IOException("No reachable address on the selected Wi-Fi link");
        for (int index = 0; index < candidates.size(); index++) {
            InetAddress candidate = candidates.get(index);
            long remaining = end - SystemClock.elapsedRealtime();
            if (remaining <= 0) break;
            Socket created = new Socket();
            synchronized (this) {
                if (!active) { created.close(); return null; }
                socket = created; // stop can close a pending connect, including a fallback attempt.
            }
            try {
                wifi.bindSocket(created);
                // Share the original eight-second budget across all validated addresses.
                // A single-host legacy resolver retains the full original connect timeout.
                int timeout = (int) Math.max(1, remaining / (candidates.size() - index));
                created.connect(new InetSocketAddress(candidate, port), timeout);
                return created;
            } catch (IOException error) {
                last = error;
                try { created.close(); } catch (IOException ignored) {}
                synchronized (this) { if (socket == created) socket = null; }
                if (!active) return null;
            }
        }
        throw last;
    }

    private boolean sameSubnet(InetAddress remote) {
        return LanAddressPolicy.allowedRemote(remote, localLinks, interfaceIndex) != null;
    }

    private boolean adopt(Socket connected) throws Exception {
        connected.setTcpNoDelay(true);
        connected.setSoTimeout(0); // A player can think indefinitely. stop() closes and unblocks this socket.
        synchronized (this) {
            if (!active || (socket != null && socket != connected)) { connected.close(); return false; }
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
        if (drained != null) throw new IllegalStateException("Connection is closing");
        if (!active || !ready || socket == null) throw new IllegalStateException("LAN is not connected");
        if (frames.size() >= 16) throw new IllegalStateException("LAN send queue is full (16 frames)");
        frames.add(frame); pump();
    }

    private void pump() {
        if (drained != null && !writing && frames.isEmpty()) { finishDrain(); return; }
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
        if (multiHost) { registrations.stop(); return; }
        if (registering) { try { nsd.unregisterService(registration); } catch (Exception ignored) {} }
        // Keep the flag for the late onServiceRegistered cleanup; unregister is idempotently guarded by Android.
    }
    public void setListingVisible(boolean visible) throws Exception {
        if (!multiHost) { Transport.super.setListingVisible(visible); return; }
        if (!active) throw new IllegalStateException("LAN host is not running");
        registrations.setListed(visible);
    }
    public void drainAndStop(Runnable completed) {
        if (drained != null) return;
        drained = completed;
        if (!active || !ready || (!writing && frames.isEmpty())) finishDrain();
        else deadlines.post(drainTimeout, 5_000);
    }
    private void finishDrain() {
        Runnable completed = drained;
        drained = null;
        stop();
        if (completed != null) completed.run();
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
        drained = null;
        synchronized (this) {
            active = false;
            closeListeners();
            for (Channel channel : channels.values()) channel.close();
            channels.clear();
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
