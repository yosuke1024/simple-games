import Foundation
import UIKit
import CoreBluetooth
import Network
import Capacitor

/// User-started nearby transport. BLE may continue while the web runtime is
/// suspended; logical-session recovery after a lost radio link belongs to JS.
/// All state, delegates, Network callbacks and timeouts run on the main queue.
@objc(NearbyPlayPlugin)
public final class NearbyPlayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NearbyPlayPlugin"
    public let jsName = "NearbyPlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readHistory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeHistory", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearHistory", returnType: CAPPluginReturnPromise)
    ]

    private static let service = CBUUID(string: "9b5d2000-7a4c-4e13-a280-75d53c01a268")
    private static let inbound = CBUUID(string: "9b5d2001-7a4c-4e13-a280-75d53c01a268")
    private static let outbound = CBUUID(string: "9b5d2002-7a4c-4e13-a280-75d53c01a268")
    private static let metadata = CBUUID(string: "9b5d2003-7a4c-4e13-a280-75d53c01a268")
    private static let bonjour = "_sgnearplay._tcp"
    private static let maxBytes = 4096
    private static let maxFrames = 16
    private static let maxPeers = 16

    // A replacement bridge can coexist briefly with writes from the old instance.
    // Keep file access and capacity process-wide across that lifecycle boundary.
    private static let historyQueue = DispatchQueue(label: "com.pixapps.simplegames.nearby.history")
    // One operation runs at a time; at most four more retain their bounded input.
    private static let historySlots = DispatchSemaphore(value: 5)
    private let history = NearbyPlayHistoryStore()

    private var running = false
    private var connected = false
    private var transport = ""
    private var role = ""
    private var label = ""
    private var listingData: Data?
    private var epoch = 0
    private var lifecycleObservers: [NSObjectProtocol] = []
    private let eventBuffer = NearbyPlayEventBuffer()
    private let sessionDeadline = NearbyPlayForegroundDeadline()
    private let sendDeadline = NearbyPlayForegroundDeadline()
    private let receiveDeadline = NearbyPlayForegroundDeadline()
    private var received = Data()
    private var outgoing: [Data] = []
    private var offset = 0
    private var writeInFlight = 0
    private var networkSending = false

    private var centralManager: CBCentralManager?
    private var peripheralManager: CBPeripheralManager?
    private var bluetoothState: CBManagerState?
    private var blePeers: [String: CBPeripheral] = [:]
    private let discoveryIndex = NearbyPlayDiscoveryIndex()
    private var discoveryMaintenance: DispatchWorkItem?
    private let probeDeadline = NearbyPlayForegroundDeadline()
    private var probePeripheral: CBPeripheral?
    private var probeLabel: String?
    private var probeListing: String?
    private var probeSucceeded = false
    private var probeDisconnecting = false
    private var remotePeripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var notifyCharacteristic: CBCharacteristic?
    private var subscriptionPending = false
    private var beforeSubscriptionReady = Data()
    private var localNotifyCharacteristic: CBMutableCharacteristic?
    private var subscribedCentral: CBCentral?

    private var listener: NWListener?
    private var browser: NWBrowser?
    private var connection: NWConnection?
    private var lanPeers: [String: NWEndpoint] = [:]
    private var lanListings: [String: String] = [:]

    public override func load() {
        // Loading the plugin and reading capabilities perform no discovery or permission request.
        lifecycleObservers = [
            NotificationCenter.default.addObserver(
                forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
            ) { [weak self] _ in self?.setApplicationActive(false) },
            NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { [weak self] _ in self?.setApplicationActive(true) }
        ]
        if UIApplication.shared.applicationState != .active { setApplicationActive(false) }
    }

    deinit {
        for observer in lifecycleObservers { NotificationCenter.default.removeObserver(observer) }
        sessionDeadline.cancel()
        sendDeadline.cancel()
        receiveDeadline.cancel()
        probeDeadline.cancel()
        discoveryMaintenance?.cancel()
        browser?.cancel()
        listener?.cancel()
        connection?.cancel()
        centralManager?.delegate = nil
        centralManager?.stopScan()
        if let peripheral = remotePeripheral { centralManager?.cancelPeripheralConnection(peripheral) }
        if let peripheral = probePeripheral { centralManager?.cancelPeripheralConnection(peripheral) }
        peripheralManager?.delegate = nil
        peripheralManager?.stopAdvertising()
        peripheralManager?.removeAllServices()
    }

    /// Only actual bridge destruction ends the native transport. A temporary
    /// view disappearance, another app, or a system dialog is not an exit.
    func shutdown() {
        if Thread.isMainThread { stopSession(reason: "view-destroyed") }
        else { DispatchQueue.main.async { [weak self] in self?.stopSession(reason: "view-destroyed") } }
    }

    @objc func capabilities(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // CoreBluetooth cannot establish radio availability without creating a manager.
            // `false` plus availabilityKnown=false must not be presented as hardware failure.
            let state = self.bluetoothState
            call.resolve([
                "platform": "ios", "bleSupported": state != .unsupported,
                "canAdvertise": state != .unsupported,
                "bluetoothEnabled": state == .poweredOn,
                "availabilityKnown": state != nil && state != .unknown && state != .resetting,
                "bluetoothState": state.map { String($0.rawValue) } ?? "unknown"
            ])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let transport = call.getString("transport"), ["ble", "lan"].contains(transport),
                  let role = call.getString("role"), ["advertise", "browse"].contains(role),
                  let label = call.getString("label"), Self.validLabel(label) else {
                call.reject("Expected ble/lan, advertise/browse and P-/F- followed by six hexadecimal digits.", "ARGUMENT")
                return
            }
            guard UIApplication.shared.applicationState == .active else {
                call.reject("Open Nearby Play in the foreground before starting.", "BACKGROUND")
                return
            }
            let listing = call.getString("listing")?.data(using: .utf8)
            if let listing {
                guard role == "advertise", call.getBool("resume") != true,
                      NearbyPlayListing.supportsProbe(label),
                      NearbyPlayListing.string(listing, lan: transport == "lan") != nil else {
                    call.reject("Expected bounded discovery JSON for a new metadata-capable host.", "LISTING")
                    return
                }
            }
            // Automatic recovery must never turn a revoked permission into a
            // new system prompt. Only a fresh, explicit start may request it.
            if call.getBool("resume") == true, transport == "ble",
               CBManager.authorization != .allowedAlways {
                call.reject("Bluetooth permission is required to resume this gathering.", "BLUETOOTH_PERMISSION")
                return
            }
            self.eventBuffer.removeAll()
            self.stopSession(reason: "restarted")
            self.running = true
            self.transport = transport
            self.role = role
            self.label = label
            self.listingData = listing
            self.armSessionDeadline(seconds: 60, message: "Discovery expired; start again explicitly.")
            if transport == "ble" {
                // These are the only manager constructors: start is the permission boundary.
                if role == "browse" {
                    self.centralManager = CBCentralManager(delegate: self, queue: .main,
                        options: [CBCentralManagerOptionShowPowerAlertKey: false])
                } else {
                    self.peripheralManager = CBPeripheralManager(delegate: self, queue: .main,
                        options: [CBPeripheralManagerOptionShowPowerAlertKey: false])
                }
            } else {
                self.startLAN()
            }
            call.resolve()
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.running, self.role == "browse", !self.connected,
                  self.remotePeripheral == nil, self.connection == nil,
                  let id = call.getString("peerId") else {
                call.reject("Start browsing and select one discovered peer.", "STATE")
                return
            }
            if self.transport == "ble" {
                guard let peer = self.blePeers[id], self.discoveryIndex.entries[id]?.announced == true,
                      let manager = self.centralManager else {
                    call.reject("Peer was not discovered in this session.", "PEER")
                    return
                }
                manager.stopScan()
                self.discoveryMaintenance?.cancel(); self.discoveryMaintenance = nil
                self.cancelProbe(failed: false)
                self.remotePeripheral = peer
                peer.delegate = self
                self.armSessionDeadline(seconds: 15, message: "Bluetooth connection/subscription timed out.")
                // A refresh probe may still be disconnecting. Do not overlap
                // that link (or mistake its callback for the selected session).
                if self.probePeripheral == nil { manager.connect(peer, options: nil) }
            } else {
                guard let endpoint = self.lanPeers[id] else {
                    call.reject("Peer was not discovered in this session.", "PEER")
                    return
                }
                self.browser?.cancel()
                self.browser = nil
                self.openConnection(NWConnection(to: endpoint, using: Self.lanParameters()))
            }
            call.resolve()
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.connected else { call.reject("No usable peer connection.", "STATE"); return }
            guard let value = call.getString("data"), let data = value.data(using: .utf8),
                  Self.validFrame(data) else {
                call.reject("Expected JSON without raw LF, at most 4096 UTF-8 bytes.", "FRAME")
                self.fail("FRAME", "Invalid outbound frame.")
                return
            }
            guard self.outgoing.count < Self.maxFrames else {
                call.reject("The 16-frame send queue is full.", "OVERFLOW")
                self.fail("OVERFLOW", "Send queue overflow; connection closed.")
                return
            }
            var frame = data
            frame.append(10)
            self.outgoing.append(frame)
            // Acceptance is not delivery: the JS protocol acknowledges game messages.
            call.resolve()
            self.pump()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.eventBuffer.removeAll()
            self.stopSession(reason: "stopped")
            call.resolve()
        }
    }

    @objc func readHistory(_ call: CAPPluginCall) {
        guard reserveHistory(call) else { return }
        Self.historyQueue.async {
            defer { Self.historySlots.signal() }
            do { call.resolve(["data": try self.history.read().map { $0 as Any } ?? NSNull()]) }
            catch { call.reject("Could not read nearby history.", "HISTORY_READ") }
        }
    }

    @objc func writeHistory(_ call: CAPPluginCall) {
        guard let value = call.getString("data"), value.utf8.count <= NearbyPlayHistoryStore.maxBytes else {
            call.reject("History must be a UTF-8 string of at most 2 MiB.", "HISTORY_SIZE")
            return
        }
        guard reserveHistory(call) else { return }
        Self.historyQueue.async {
            defer { Self.historySlots.signal() }
            do { try self.history.write(value); call.resolve() }
            catch { call.reject("Could not save nearby history.", "HISTORY_WRITE") }
        }
    }

    @objc func clearHistory(_ call: CAPPluginCall) {
        guard reserveHistory(call) else { return }
        Self.historyQueue.async {
            defer { Self.historySlots.signal() }
            do { try self.history.clear(); call.resolve() }
            catch { call.reject("Could not clear nearby history.", "HISTORY_CLEAR") }
        }
    }

    private func reserveHistory(_ call: CAPPluginCall) -> Bool {
        guard Self.historySlots.wait(timeout: .now()) == .success else {
            call.reject("Nearby history is busy. Try again after the current operation.", "HISTORY_BUSY")
            return false
        }
        return true
    }

    private func setApplicationActive(_ active: Bool) {
        if active {
            guard !eventBuffer.active else { return }
            // Deliver queued ACKs/data/disconnects before JS resumes its timers
            // or authenticates a replacement connection.
            for value in eventBuffer.resume() { notifyListeners("nearbyEvent", data: value) }
            notifyListeners("nearbyEvent", data: ["type": "lifecycle", "active": true])
            sessionDeadline.resume()
            sendDeadline.resume()
            receiveDeadline.resume()
            if running, role == "browse", transport == "ble", remotePeripheral == nil {
                // Background scans coalesce duplicates. Revalidate every entry
                // instead of displaying a room that became full while hidden.
                for (id, entry) in discoveryIndex.entries where entry.announced {
                    event(["type": "peerLost", "id": id])
                }
                discoveryIndex.removeAll(); blePeers.removeAll()
                centralManager?.stopScan()
                if centralManager?.state == .poweredOn { startBLEScan() }
            } else if running, role == "browse", transport == "lan", connection == nil {
                for id in lanPeers.keys { event(["type": "peerLost", "id": id]) }
                lanPeers.removeAll(); lanListings.removeAll()
                browser?.cancel(); browser = nil
                startLAN()
            }
        } else {
            guard eventBuffer.suspend() else { return }
            sessionDeadline.pause()
            sendDeadline.pause()
            receiveDeadline.pause()
            discoveryMaintenance?.cancel(); discoveryMaintenance = nil
            cancelProbe(failed: false)
            notifyListeners("nearbyEvent", data: ["type": "lifecycle", "active": false])
            // CoreBluetooth may wake these delegates with the declared central /
            // peripheral modes. No background task, keepalive, or JS loop is used.
            // LAN is retained opportunistically; iOS can suspend its TCP work.
        }
    }

    private func event(_ value: [String: Any]) {
        if eventBuffer.active {
            notifyListeners("nearbyEvent", data: value)
        } else if !eventBuffer.append(value) {
            // Bound memory even if a peer keeps writing while WebKit is asleep.
            // JS replays acknowledged-session traffic after authenticated rejoin.
            stopSession(reason: "BACKGROUND_OVERFLOW", notifyDisconnect: false)
            eventBuffer.removeAll()
            _ = eventBuffer.append(["type": "error", "code": "BACKGROUND_OVERFLOW",
                "message": "Background receive buffer filled; reconnect to synchronize."])
            _ = eventBuffer.append(["type": "disconnected", "reason": "BACKGROUND_OVERFLOW"])
        }
    }
    private func status(_ message: String) { event(["type": "status", "message": message]) }

    private func fail(_ code: String, _ message: String) {
        guard running else { return }
        event(["type": "error", "code": code, "message": message])
        stopSession(reason: code)
    }

    private func stopSession(reason: String, notifyDisconnect: Bool = true) {
        let wasRunning = running
        running = false
        connected = false
        epoch += 1
        sessionDeadline.cancel()
        sendDeadline.cancel()
        receiveDeadline.cancel()
        discoveryMaintenance?.cancel(); discoveryMaintenance = nil
        cancelProbe(failed: false, abandon: true)
        browser?.cancel(); browser = nil
        listener?.cancel(); listener = nil
        connection?.stateUpdateHandler = nil
        connection?.cancel(); connection = nil
        centralManager?.delegate = nil
        centralManager?.stopScan()
        remotePeripheral?.delegate = nil
        if let peer = remotePeripheral { centralManager?.cancelPeripheralConnection(peer) }
        peripheralManager?.delegate = nil
        peripheralManager?.stopAdvertising()
        peripheralManager?.removeAllServices()
        centralManager = nil; peripheralManager = nil; remotePeripheral = nil
        writeCharacteristic = nil; notifyCharacteristic = nil
        subscriptionPending = false; beforeSubscriptionReady.removeAll()
        localNotifyCharacteristic = nil; subscribedCentral = nil
        blePeers.removeAll(); lanPeers.removeAll(); lanListings.removeAll()
        discoveryIndex.removeAll(); listingData = nil
        received.removeAll(); outgoing.removeAll()
        offset = 0; writeInFlight = 0; networkSending = false
        // A stopped manager's old poweredOn value cannot establish current radio availability.
        bluetoothState = nil
        if wasRunning && notifyDisconnect { event(["type": "disconnected", "reason": reason]) }
    }

    private func armSessionDeadline(seconds: Double, message: String) {
        sessionDeadline.arm(seconds: seconds) { [weak self] in
            self?.fail("TIMEOUT", message)
        }
    }

    private func armSendDeadline() {
        guard !outgoing.isEmpty else { sendDeadline.cancel(); return }
        sendDeadline.arm(seconds: 10) { [weak self] in
            self?.fail("SEND_TIMEOUT", "No send progress for 10 foreground seconds.")
        }
    }

    private func markConnected() {
        guard running, !connected else { return }
        connected = true
        listingData = nil
        discoveryMaintenance?.cancel(); discoveryMaintenance = nil
        cancelProbe(failed: false)
        sessionDeadline.cancel()
        centralManager?.stopScan()
        peripheralManager?.stopAdvertising()
        browser?.cancel(); browser = nil
        // The accepted NWConnection is independent of the listener. Withdraw Bonjour
        // and stop accepting additional sockets as soon as this one is usable.
        listener?.cancel(); listener = nil
        // A lost connection can be restarted by the foreground JS recovery
        // flow; native never silently chooses or authenticates a new peer.
        blePeers.removeAll(); lanPeers.removeAll(); lanListings.removeAll()
        discoveryIndex.removeAll()
        event(["type": "connected"])
        // A peer may notify immediately on subscription, before our OS has
        // delivered its notification-state callback. Emit connected first.
        if !beforeSubscriptionReady.isEmpty {
            let pending = beforeSubscriptionReady
            beforeSubscriptionReady.removeAll()
            receive(pending)
        }
    }

    private static func validFrame(_ data: Data) -> Bool {
        !data.isEmpty && data.count <= maxBytes && !data.contains(10) &&
            String(data: data, encoding: .utf8) != nil &&
            (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) != nil
    }

    private func receive(_ data: Data) {
        guard !data.isEmpty else { fail("FRAME", "Empty transport fragment."); return }
        guard connected else {
            // Only central notifications after an explicit setNotifyValue call
            // may wait here. Unsolicited peripheral writes remain an error.
            guard transport == "ble", role == "browse", subscriptionPending,
                  beforeSubscriptionReady.count + data.count <= Self.maxBytes + 1 else {
                fail("FRAME", "Unexpected or excessive data before subscription was usable."); return
            }
            beforeSubscriptionReady.append(data)
            return
        }
        var frames: [String] = []
        for byte in data {
            if byte == 10 {
                guard Self.validFrame(received), let text = String(data: received, encoding: .utf8) else {
                    fail("FRAME", "Invalid JSON, UTF-8 or empty frame from peer."); return
                }
                guard frames.count < Self.maxFrames else {
                    fail("OVERFLOW", "More than 16 inbound frames in one receive batch."); return
                }
                frames.append(text)
                received.removeAll(keepingCapacity: true)
            } else {
                guard received.count < Self.maxBytes else { fail("FRAME", "Peer frame exceeds 4096 bytes."); return }
                received.append(byte)
            }
        }
        // Progress, including a fresh BLE fragment, renews the one-shot timer.
        // A valid large frame must not expire merely because the radio is slow.
        receiveDeadline.cancel()
        if !received.isEmpty {
            receiveDeadline.arm(seconds: 15) { [weak self] in
                self?.fail("FRAME_TIMEOUT", "No progress on an incomplete peer frame for 15 foreground seconds.")
            }
        }
        // Validate the complete bounded batch before scheduling any bridge events.
        for text in frames {
            guard running else { break }
            event(["type": "data", "data": text])
        }
    }

    private func advance(_ count: Int) {
        guard !outgoing.isEmpty else { return }
        offset += count
        if offset == outgoing[0].count { outgoing.removeFirst(); offset = 0 }
        armSendDeadline()
    }

    private func pump() {
        guard connected, !outgoing.isEmpty else { return }
        if transport == "lan" {
            guard !networkSending, let peer = connection else { return }
            networkSending = true
            armSendDeadline()
            let frame = outgoing[0]
            peer.send(content: frame, completion: .contentProcessed { [weak self, weak peer] error in
                guard let self, let peer, self.connection === peer, self.running else { return }
                self.networkSending = false
                if let error { self.fail("SEND", error.localizedDescription); return }
                self.advance(frame.count)
                self.pump()
            })
        } else if role == "browse" {
            guard writeInFlight == 0, let peer = remotePeripheral, let characteristic = writeCharacteristic else { return }
            let frame = outgoing[0]
            let size = min(20, frame.count - offset, peer.maximumWriteValueLength(for: .withResponse))
            guard size > 0 else { fail("MTU", "Peer cannot accept a GATT write."); return }
            writeInFlight = size
            armSendDeadline()
            peer.writeValue(frame.subdata(in: offset..<(offset + size)), for: characteristic, type: .withResponse)
        } else {
            guard let manager = peripheralManager, let characteristic = localNotifyCharacteristic,
                  let central = subscribedCentral else { return }
            // updateValue=false is backpressure, not delivery failure. Resume from the delegate.
            while !outgoing.isEmpty {
                let frame = outgoing[0]
                let size = min(20, frame.count - offset, central.maximumUpdateValueLength)
                guard size > 0 else { fail("MTU", "Peer cannot accept a GATT notification."); return }
                armSendDeadline()
                guard manager.updateValue(frame.subdata(in: offset..<(offset + size)),
                    for: characteristic, onSubscribedCentrals: [central]) else { return }
                advance(size)
            }
        }
    }

    private static func validLabel(_ value: String) -> Bool {
        value.utf8.count == 8 && value.range(of: "^[PF]-[0-9A-Fa-f]{6}$", options: .regularExpression) != nil
    }

    private func startBLEScan() {
        guard running, eventBuffer.active, remotePeripheral == nil else { return }
        centralManager?.scanForPeripherals(withServices: [Self.service],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
        scheduleDiscoveryMaintenance()
    }

    private func scheduleDiscoveryMaintenance() {
        discoveryMaintenance?.cancel()
        guard running, eventBuffer.active, transport == "ble", role == "browse", remotePeripheral == nil else { return }
        let generation = epoch
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.running, self.epoch == generation, self.eventBuffer.active,
                  self.remotePeripheral == nil else { return }
            for id in self.discoveryIndex.expire(now: ProcessInfo.processInfo.systemUptime) {
                self.event(["type": "peerLost", "id": id])
            }
            self.blePeers = self.blePeers.filter { self.discoveryIndex.entries[$0.key] != nil }
            self.startNextProbe()
            self.scheduleDiscoveryMaintenance()
        }
        discoveryMaintenance = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
    }

    private func startNextProbe() {
        guard running, eventBuffer.active, remotePeripheral == nil, probePeripheral == nil,
              let manager = centralManager, manager.state == .poweredOn,
              let id = discoveryIndex.nextProbe(now: ProcessInfo.processInfo.systemUptime),
              let peer = blePeers[id], let entry = discoveryIndex.entries[id] else { return }
        discoveryIndex.checked(id, now: ProcessInfo.processInfo.systemUptime)
        probePeripheral = peer
        probeLabel = entry.label
        probeListing = nil
        probeSucceeded = false
        probeDisconnecting = false
        peer.delegate = self
        probeDeadline.arm(seconds: 5) { [weak self] in self?.cancelProbe() }
        manager.connect(peer, options: nil)
    }

    /// Cancellation stays in flight until CoreBluetooth confirms closure. The
    /// outer 60-second discovery deadline bounds an unresponsive OS callback.
    private func cancelProbe(failed: Bool = true, abandon: Bool = false) {
        probeDeadline.cancel()
        guard let peer = probePeripheral else { return }
        if failed, discoveryIndex.withdraw(peer.identifier.uuidString) {
            event(["type": "peerLost", "id": peer.identifier.uuidString])
        }
        probeSucceeded = false
        probeDisconnecting = true
        peer.delegate = nil
        centralManager?.cancelPeripheralConnection(peer)
        if abandon { resetProbe() }
    }

    private func resetProbe() {
        probeDeadline.cancel()
        probePeripheral = nil; probeLabel = nil; probeListing = nil
        probeSucceeded = false; probeDisconnecting = false
    }

    private func completeProbe(listing: String?) {
        guard let peer = probePeripheral, !probeDisconnecting else { return }
        probeListing = listing
        probeSucceeded = true
        probeDisconnecting = true
        peer.delegate = nil
        centralManager?.cancelPeripheralConnection(peer)
    }

    private func didCloseProbe() {
        guard let peer = probePeripheral else { return }
        let id = peer.identifier.uuidString
        let name = probeLabel
        let listing = probeListing
        let success = probeSucceeded
        resetProbe()
        if remotePeripheral == nil, eventBuffer.active, discoveryIndex.entries[id]?.label == name {
            if success, listing.map({ !NearbyPlayListing.unavailable($0) }) ?? true {
                if discoveryIndex.publish(id, listing: listing, now: ProcessInfo.processInfo.systemUptime), let name {
                    var value: [String: Any] = ["type": "peer", "id": id, "name": name]
                    if let listing { value["listing"] = listing }
                    event(value)
                }
            } else if discoveryIndex.withdraw(id) {
                event(["type": "peerLost", "id": id])
            }
        }
        if let selected = remotePeripheral {
            selected.delegate = self
            centralManager?.connect(selected, options: nil)
        } else { startNextProbe() }
    }

    private static func lanLabel(_ name: String) -> String? {
        guard name.hasPrefix("NP-"), name.utf8.count <= 32 else { return nil }
        let value = String(name.dropFirst(3).prefix(8))
        guard validLabel(value) else { return nil }
        let suffix = String(name.dropFirst(11))
        guard suffix.isEmpty || suffix.range(of: #"^ \([1-9][0-9]{0,3}\)$"#, options: .regularExpression) != nil else { return nil }
        return value
    }

    private static func lanParameters() -> NWParameters {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .wifi
        parameters.includePeerToPeer = false
        // Let Bonjour/Network choose IPv4 or IPv6 on the required Wi-Fi path.
        // Connections still use only endpoints discovered in this session.
        let ip = parameters.defaultProtocolStack.internetProtocol as? NWProtocolIP.Options
        ip?.version = .any
        return parameters
    }

    private func startLAN() {
        let generation = epoch
        if role == "advertise" {
            do {
                let server = try NWListener(using: Self.lanParameters(), on: .any)
                listener = server
                server.service = NWListener.Service(name: "NP-" + label, type: Self.bonjour, domain: "local.",
                    txtRecord: NearbyPlayListing.txtRecord(listingData))
                server.stateUpdateHandler = { [weak self] state in
                    guard let self, self.running, self.epoch == generation else { return }
                    switch state {
                    case .ready: self.status("Advertising on local Wi-Fi; choose this label on the other device.")
                    case .failed(let error), .waiting(let error): self.fail("LAN_LISTEN", error.localizedDescription)
                    default: break
                    }
                }
                server.newConnectionHandler = { [weak self] peer in
                    guard let self, self.running, self.epoch == generation, self.connection == nil else { peer.cancel(); return }
                    self.openConnection(peer)
                }
                server.start(queue: .main)
            } catch { fail("LAN_LISTEN", error.localizedDescription) }
        } else {
            let discovery = NWBrowser(for: .bonjourWithTXTRecord(type: Self.bonjour, domain: "local."), using: Self.lanParameters())
            browser = discovery
            discovery.stateUpdateHandler = { [weak self, weak discovery] state in
                guard let self, let discovery, self.browser === discovery, self.running, self.epoch == generation else { return }
                switch state {
                case .ready: self.status("Browsing the same Wi-Fi network for 60 seconds.")
                case .failed(let error), .waiting(let error): self.fail("LAN_BROWSE", error.localizedDescription)
                default: break
                }
            }
            discovery.browseResultsChangedHandler = { [weak self, weak discovery] results, _ in
                guard let self, let discovery, self.browser === discovery,
                      self.running, self.epoch == generation, self.connection == nil else { return }
                var current: [String: NWEndpoint] = [:]
                var listings: [String: String] = [:]
                for result in results {
                    guard case let .service(name, type, domain, _) = result.endpoint,
                          let roomLabel = Self.lanLabel(name), type.trimmingCharacters(in: CharacterSet(charactersIn: ".")) == Self.bonjour,
                          domain == "local.",
                          current.count < Self.maxPeers else { continue }
                    let id = "lan:" + name + ":" + domain
                    var listing: String?
                    if case let .bonjour(record) = result.metadata, let raw = record["listing"] {
                        guard let valid = NearbyPlayListing.string(Data(raw.utf8), lan: true),
                              !NearbyPlayListing.unavailable(valid) else { continue }
                        listing = valid
                        listings[id] = valid
                    }
                    current[id] = result.endpoint
                    if self.lanPeers[id] == nil || self.lanListings[id] != listing {
                        var value: [String: Any] = ["type": "peer", "id": id, "name": roomLabel]
                        if let listing { value["listing"] = listing }
                        self.event(value)
                    }
                }
                for id in self.lanPeers.keys where current[id] == nil { self.event(["type": "peerLost", "id": id]) }
                self.lanPeers = current
                self.lanListings = listings
            }
            discovery.start(queue: .main)
        }
    }

    private func openConnection(_ peer: NWConnection) {
        connection = peer
        armSessionDeadline(seconds: 15, message: "LAN connection timed out. Check Wi-Fi, local-network access and AP/client isolation.")
        peer.stateUpdateHandler = { [weak self, weak peer] state in
            guard let self, let peer, self.connection === peer, self.running else { return }
            switch state {
            case .ready:
                self.markConnected()
                self.readConnection(peer)
            case .failed(let error), .waiting(let error): self.fail("LAN_CONNECT", error.localizedDescription)
            case .cancelled: self.stopSession(reason: "peer-disconnected")
            default: break
            }
        }
        peer.start(queue: .main)
    }

    private func readConnection(_ peer: NWConnection) {
        peer.receive(minimumIncompleteLength: 1, maximumLength: Self.maxBytes + 1) { [weak self, weak peer] data, _, complete, error in
            guard let self, let peer, self.connection === peer, self.running else { return }
            if let data, !data.isEmpty { self.receive(data) }
            guard self.running else { return }
            if let error { self.fail("LAN_READ", error.localizedDescription); return }
            if complete { self.stopSession(reason: "peer-disconnected"); return }
            self.readConnection(peer)
        }
    }
}

extension NearbyPlayPlugin: CBCentralManagerDelegate, CBPeripheralDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard running, central === centralManager else { return }
        bluetoothState = central.state
        switch central.state {
        case .poweredOn:
            startBLEScan()
            status("Bluetooth browse started for 60 seconds.")
        case .unknown: break
        case .resetting: fail("BLUETOOTH_RESET", "Bluetooth is resetting; start again explicitly when it is ready.")
        case .unauthorized: fail("BLUETOOTH_PERMISSION", "Bluetooth permission was denied. Enable it in Settings before retrying.")
        case .unsupported: fail("BLUETOOTH_UNSUPPORTED", "Bluetooth LE is unavailable on this device.")
        case .poweredOff: fail("BLUETOOTH_OFF", "Turn on Bluetooth before retrying.")
        @unknown default: fail("BLUETOOTH", "Unknown Bluetooth state.")
        }
    }

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                              advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard running, eventBuffer.active, central === centralManager, remotePeripheral == nil else { return }
        let id = peripheral.identifier.uuidString
        // iOS advertises a short local name; Android carries the same 8-byte
        // label as service data. Neither path exposes the phone's system name.
        let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let serviceData = advertisementData[CBAdvertisementDataServiceDataKey] as? [CBUUID: Data]
        var serviceName: String?
        if let data = serviceData?[Self.service], data.count == 8,
           let value = String(data: data, encoding: .utf8), Self.validLabel(value) {
            serviceName = value
        }
        guard let name = localName.flatMap({ Self.validLabel($0) ? $0 : nil }) ?? serviceName else { return }
        if let previous = discoveryIndex.entries[id], previous.label != name {
            if previous.announced { event(["type": "peerLost", "id": id]) }
            if peripheral === probePeripheral { cancelProbe() }
        }
        let now = ProcessInfo.processInfo.systemUptime
        guard discoveryIndex.observe(id, label: name, now: now) else { return }
        blePeers[id] = peripheral
        if !NearbyPlayListing.supportsProbe(name) {
            // Never connect to an old host merely to inspect it.
            if discoveryIndex.publish(id, listing: nil, now: now) { event(["type": "peer", "id": id, "name": name]) }
        } else { startNextProbe() }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard running, central === centralManager else { return }
        if peripheral === probePeripheral {
            if probeDisconnecting { central.cancelPeripheralConnection(peripheral) }
            else { peripheral.discoverServices([Self.service]) }
            return
        }
        guard peripheral === remotePeripheral else { return }
        peripheral.discoverServices([Self.service])
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard running, central === centralManager else { return }
        if peripheral === probePeripheral { probeSucceeded = false; didCloseProbe(); return }
        guard peripheral === remotePeripheral else { return }
        fail("BLE_CONNECT", error?.localizedDescription ?? "Bluetooth connection failed.")
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard running, central === centralManager else { return }
        if peripheral === probePeripheral { didCloseProbe(); return }
        guard peripheral === remotePeripheral else { return }
        stopSession(reason: "peer-disconnected")
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if peripheral === probePeripheral, probeDisconnecting { return }
        if running, peripheral === probePeripheral, !probeDisconnecting {
            guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == Self.service }) else {
                cancelProbe(); return
            }
            peripheral.discoverCharacteristics([Self.metadata], for: service)
            return
        }
        guard running, peripheral === remotePeripheral else { return }
        guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == Self.service }) else {
            fail("BLE_SERVICE", error?.localizedDescription ?? "Required service is missing."); return
        }
        peripheral.discoverCharacteristics([Self.inbound, Self.outbound], for: service)
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if peripheral === probePeripheral, probeDisconnecting { return }
        if running, peripheral === probePeripheral, !probeDisconnecting, service.uuid == Self.service {
            guard error == nil else { cancelProbe(); return }
            guard let metadata = service.characteristics?.first(where: { $0.uuid == Self.metadata && $0.properties.contains(.read) }) else {
                cancelProbe(); return
            }
            peripheral.readValue(for: metadata)
            return
        }
        guard running, peripheral === remotePeripheral, service.uuid == Self.service else { return }
        guard error == nil,
              let write = service.characteristics?.first(where: { $0.uuid == Self.inbound && $0.properties.contains(.write) }),
              let notify = service.characteristics?.first(where: {
                  $0.uuid == Self.outbound && ($0.properties.contains(.notify) || $0.properties.contains(.indicate))
              }) else {
            fail("BLE_CHARACTERISTICS", error?.localizedDescription ?? "Required write and notify characteristics are missing."); return
        }
        writeCharacteristic = write
        notifyCharacteristic = notify
        subscriptionPending = true
        peripheral.setNotifyValue(true, for: notify)
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard running, peripheral === remotePeripheral, characteristic.uuid == Self.outbound else { return }
        guard error == nil, characteristic.isNotifying else {
            fail("BLE_SUBSCRIBE", error?.localizedDescription ?? "Notification subscription stopped."); return
        }
        subscriptionPending = false
        markConnected()
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if peripheral === probePeripheral, probeDisconnecting { return }
        if running, peripheral === probePeripheral, !probeDisconnecting, characteristic.uuid == Self.metadata {
            guard error == nil, let data = characteristic.value else { cancelProbe(); return }
            if data.isEmpty { completeProbe(listing: nil); return }
            guard let listing = NearbyPlayListing.string(data) else { cancelProbe(); return }
            completeProbe(listing: listing)
            return
        }
        guard running, peripheral === remotePeripheral, characteristic.uuid == Self.outbound else { return }
        guard error == nil, let data = characteristic.value, !data.isEmpty, data.count <= 20 else {
            fail("BLE_READ", error?.localizedDescription ?? "Expected a notification fragment of 1–20 bytes."); return
        }
        receive(data)
    }

    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard running, peripheral === remotePeripheral, characteristic.uuid == Self.inbound else { return }
        guard error == nil, writeInFlight > 0 else { fail("BLE_WRITE", error?.localizedDescription ?? "Unexpected write acknowledgement."); return }
        let count = writeInFlight
        writeInFlight = 0
        advance(count)
        pump()
    }

    public func peripheral(_ peripheral: CBPeripheral, didModifyServices invalidatedServices: [CBService]) {
        if running, peripheral === probePeripheral, invalidatedServices.contains(where: { $0.uuid == Self.service }) {
            cancelProbe(); return
        }
        guard running, peripheral === remotePeripheral, invalidatedServices.contains(where: { $0.uuid == Self.service }) else { return }
        fail("BLE_SERVICE", "Peer invalidated the nearby service.")
    }
}

extension NearbyPlayPlugin: CBPeripheralManagerDelegate {
    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard running, peripheral === peripheralManager else { return }
        bluetoothState = peripheral.state
        switch peripheral.state {
        case .poweredOn:
            let inbound = CBMutableCharacteristic(type: Self.inbound, properties: [.write], value: nil, permissions: [.writeable])
            let outbound = CBMutableCharacteristic(type: Self.outbound, properties: [.notify], value: nil, permissions: [])
            let metadata = CBMutableCharacteristic(type: Self.metadata, properties: [.read], value: nil, permissions: [.readable])
            localNotifyCharacteristic = outbound
            let service = CBMutableService(type: Self.service, primary: true)
            service.characteristics = [inbound, outbound, metadata]
            peripheral.add(service)
        case .unknown: break
        case .resetting: fail("BLUETOOTH_RESET", "Bluetooth is resetting; start again explicitly when it is ready.")
        case .unauthorized: fail("BLUETOOTH_PERMISSION", "Bluetooth permission was denied. Enable it in Settings before retrying.")
        case .unsupported: fail("BLUETOOTH_UNSUPPORTED", "BLE peripheral mode is unavailable on this device.")
        case .poweredOff: fail("BLUETOOTH_OFF", "Turn on Bluetooth before retrying.")
        @unknown default: fail("BLUETOOTH", "Unknown Bluetooth state.")
        }
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        guard running, peripheral === peripheralManager, service.uuid == Self.service else { return }
        if let error { fail("BLE_SERVICE", error.localizedDescription); return }
        peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [Self.service], CBAdvertisementDataLocalNameKey: label])
    }

    public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        guard running, peripheral === peripheralManager else { return }
        if let error { fail("BLE_ADVERTISE", error.localizedDescription); return }
        status("Bluetooth advertising started for 60 seconds.")
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        guard running, peripheral === peripheralManager, characteristic.uuid == Self.outbound else { return }
        if let existing = subscribedCentral, existing.identifier != central.identifier {
            // Two viewers can choose the same room concurrently. CoreBluetooth
            // cannot disconnect a peripheral-side central; ignore the later
            // subscription and reject its writes. Notifications target only
            // the first central, whose accepted gathering remains intact.
            return
        }
        subscribedCentral = central
        markConnected()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        guard running, peripheral === peripheralManager, characteristic.uuid == Self.outbound,
              central.identifier == subscribedCentral?.identifier else { return }
        stopSession(reason: "peer-disconnected")
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        guard running, peripheral === peripheralManager else { return }
        guard request.characteristic.uuid == Self.metadata else {
            peripheral.respond(to: request, withResult: .readNotPermitted); return
        }
        // Reading public metadata never subscribes a central, claims the seat,
        // stops advertising, or emits a game connection/disconnection event.
        guard let value = NearbyPlayListing.read(connected ? nil : listingData, offset: request.offset) else {
            peripheral.respond(to: request, withResult: .invalidOffset); return
        }
        request.value = value
        peripheral.respond(to: request, withResult: .success)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        guard running, peripheral === peripheralManager, let first = requests.first else { return }
        // CoreBluetooth requires one response to the first request of an atomic batch.
        guard connected, requests.count <= Self.maxFrames,
              requests.allSatisfy({ $0.characteristic.uuid == Self.inbound && $0.offset == 0 &&
                  $0.central.identifier == subscribedCentral?.identifier && $0.value != nil && $0.value!.count <= 20 }) else {
            peripheral.respond(to: first, withResult: .requestNotSupported)
            if requests.contains(where: { $0.central.identifier == subscribedCentral?.identifier }) {
                fail("BLE_WRITE", "Invalid write or offset from the subscribed central.")
            }
            return
        }
        for request in requests {
            receive(request.value!)
            if !running { break }
        }
        peripheral.respond(to: first, withResult: running ? .success : .unlikelyError)
    }

    public func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        guard running, peripheral === peripheralManager else { return }
        pump()
    }
}
