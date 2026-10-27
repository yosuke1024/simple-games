import Foundation
import CoreFoundation

/// Public, unauthenticated discovery hints. JS validates the schema and checks
/// the selected game/room name again against the encrypted hello before admission.
enum NearbyPlayListing {
    static let maxBytes = 255
    static let maxTXTBytes = 247 // DNS-SD's one-byte length also covers "listing=".

    static func string(_ data: Data, lan: Bool = false) -> String? {
        guard !data.isEmpty, data.count <= (lan ? maxTXTBytes : maxBytes),
              let text = String(data: data, encoding: .utf8),
              (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else { return nil }
        return text
    }

    static func unavailable(_ text: String) -> Bool {
        guard let data = text.data(using: .utf8),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let value = object["available"] as? NSNumber,
              CFGetTypeID(value) == CFBooleanGetTypeID() else { return false }
        return !value.boolValue
    }

    static func supportsProbe(_ label: String) -> Bool {
        guard label.utf8.count == 8,
              label.range(of: "^[PF]-[0-9A-Fa-f]{6}$", options: .regularExpression) != nil,
              let code = UInt8(label.dropFirst(2).prefix(2), radix: 16) else { return false }
        // Old Android hosts treat a GATT connection itself as admission. Never
        // probe them; only the new fixed game-code range advertises this ability.
        return (0x81...0x8e).contains(code)
    }

    static func txtRecord(_ data: Data?) -> Data? {
        guard let data, string(data, lan: true) != nil else { return nil }
        var entry = Data("listing=".utf8)
        entry.append(data)
        var record = Data([UInt8(entry.count)])
        record.append(entry)
        return record
    }

    /// CoreBluetooth requests successive offsets for a long GATT read.
    static func read(_ data: Data?, offset: Int) -> Data? {
        let value = data ?? Data()
        guard offset >= 0, offset <= value.count else { return nil }
        return Data(value.dropFirst(offset))
    }
}

/// Each physical peer owns its framing and queue. A partial frame or stalled
/// writer must never consume, reorder, or time out another guest's traffic.
final class NearbyPlayPeerFrames {
    static let maxBytes = 4096
    static let maxFrames = 16
    enum Failure: Error { case frame, overflow }
    private(set) var received = Data()
    private(set) var outgoing: [Data] = []
    private(set) var offset = 0

    static func valid(_ data: Data) -> Bool {
        !data.isEmpty && data.count <= maxBytes && !data.contains(10) &&
            String(data: data, encoding: .utf8) != nil &&
            (try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])) != nil
    }

    func enqueue(_ data: Data) throws {
        guard Self.valid(data) else { throw Failure.frame }
        guard outgoing.count < Self.maxFrames else { throw Failure.overflow }
        var frame = data
        frame.append(10)
        outgoing.append(frame)
    }

    func receive(_ data: Data) throws -> [String] {
        guard !data.isEmpty else { throw Failure.frame }
        var frames: [String] = []
        for byte in data {
            if byte == 10 {
                guard Self.valid(received), let text = String(data: received, encoding: .utf8) else { throw Failure.frame }
                guard frames.count < Self.maxFrames else { throw Failure.overflow }
                frames.append(text)
                received.removeAll(keepingCapacity: true)
            } else {
                guard received.count < Self.maxBytes else { throw Failure.frame }
                received.append(byte)
            }
        }
        return frames
    }

    func advance(_ count: Int) {
        guard let first = outgoing.first, count > 0, count <= first.count - offset else { return }
        offset += count
        if offset == first.count { outgoing.removeFirst(); offset = 0 }
    }
}

/// A bounded foreground discovery cache. Advertising alone renews presence,
/// never the freshness of recruitment metadata (a room may now be resume-only).
final class NearbyPlayDiscoveryIndex {
    struct Entry {
        let label: String
        var seen: TimeInterval
        var checked: TimeInterval?
        var verified: TimeInterval?
        var listing: String?
        var announced = false
    }
    static let capacity = 16
    static let refresh: TimeInterval = 10
    static let ttl: TimeInterval = 15
    private(set) var entries: [String: Entry] = [:]

    @discardableResult
    func observe(_ id: String, label: String, now: TimeInterval) -> Bool {
        if var entry = entries[id], entry.label == label {
            entry.seen = now
            entries[id] = entry
            return true
        }
        guard entries[id] != nil || entries.count < Self.capacity else { return false }
        entries[id] = Entry(label: label, seen: now)
        return true
    }

    func nextProbe(now: TimeInterval) -> String? {
        entries.filter { _, entry in
            NearbyPlayListing.supportsProbe(entry.label) && now - entry.seen < Self.ttl &&
                (entry.checked == nil || now - entry.checked! >= Self.refresh)
        }.min { left, right in
            let lhs = left.value.checked ?? -.infinity
            let rhs = right.value.checked ?? -.infinity
            return lhs == rhs ? left.key < right.key : lhs < rhs
        }?.key
    }

    func checked(_ id: String, now: TimeInterval) {
        guard var entry = entries[id] else { return }
        entry.checked = now
        entries[id] = entry
    }

    @discardableResult
    func publish(_ id: String, listing: String?, now: TimeInterval) -> Bool {
        guard var entry = entries[id] else { return false }
        let changed = !entry.announced || entry.listing != listing
        entry.announced = true
        entry.listing = listing
        entry.checked = now
        entry.verified = now
        entries[id] = entry
        return changed
    }

    @discardableResult
    func withdraw(_ id: String) -> Bool {
        guard var entry = entries[id] else { return false }
        let wasAnnounced = entry.announced
        entry.announced = false
        entry.listing = nil
        entries[id] = entry
        return wasAnnounced
    }

    func expire(now: TimeInterval) -> [String] {
        var lost: [String] = []
        for (id, entry) in entries {
            if now - entry.seen >= Self.ttl {
                if entry.announced { lost.append(id) }
                entries.removeValue(forKey: id)
            } else if NearbyPlayListing.supportsProbe(entry.label), entry.announced,
                      let verified = entry.verified, now - verified >= Self.ttl {
                _ = withdraw(id)
                lost.append(id)
            }
        }
        return lost
    }

    func removeAll() { entries.removeAll() }
}

/// Main-queue state for a suspended web runtime. The native radio may keep
/// receiving, but it must not enqueue an unbounded number of bridge calls.
final class NearbyPlayEventBuffer {
    static let maxEvents = 64
    static let maxBytes = 256 * 1024
    private(set) var active = true
    private(set) var byteCount = 0
    private var events: [[String: Any]] = []

    var count: Int { events.count }

    @discardableResult
    func suspend() -> Bool {
        guard active else { return false }
        active = false
        return true
    }

    /// Failure means the transport must close and report a recoverable gap;
    /// silently discarding a reliable frame would leave the session divergent.
    func append(_ event: [String: Any]) -> Bool {
        guard !active, events.count < Self.maxEvents,
              JSONSerialization.isValidJSONObject(event),
              let data = try? JSONSerialization.data(withJSONObject: event),
              data.count <= Self.maxBytes - byteCount else { return false }
        events.append(event)
        byteCount += data.count
        return true
    }

    func resume() -> [[String: Any]] {
        active = true
        let pending = events
        removeAll()
        return pending
    }

    func removeAll() {
        events.removeAll()
        byteCount = 0
    }
}

/// A no-progress timeout counts only while the app is active. OS suspension
/// must not turn a queued timeout into an immediate disconnect upon return.
/// Generation checks also invalidate callbacks already queued before cancel.
final class NearbyPlayForegroundDeadline {
    typealias Scheduler = (TimeInterval, @escaping () -> Void) -> () -> Void
    private let schedule: Scheduler
    private var cancellation: (() -> Void)?
    private var action: (() -> Void)?
    private var seconds: TimeInterval = 0
    private var active = true
    private var generation = 0

    init(schedule: @escaping Scheduler = { seconds, action in
        let work = DispatchWorkItem(block: action)
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
        return { work.cancel() }
    }) {
        self.schedule = schedule
    }

    func arm(seconds: TimeInterval, action: @escaping () -> Void) {
        invalidate()
        self.seconds = seconds
        self.action = action
        scheduleIfActive()
    }

    func cancel() {
        invalidate()
        action = nil
    }

    func pause() {
        active = false
        invalidate()
    }

    func resume() {
        guard !active else { return }
        active = true
        scheduleIfActive()
    }

    private func invalidate() {
        generation += 1
        cancellation?()
        cancellation = nil
    }

    private func scheduleIfActive() {
        guard active, action != nil else { return }
        let expected = generation
        cancellation = schedule(seconds) { [weak self] in
            guard let self, self.active, self.generation == expected else { return }
            let callback = self.action
            self.cancel()
            callback?()
        }
    }
}
