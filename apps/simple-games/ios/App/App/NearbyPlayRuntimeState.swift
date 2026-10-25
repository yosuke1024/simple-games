import Foundation

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
