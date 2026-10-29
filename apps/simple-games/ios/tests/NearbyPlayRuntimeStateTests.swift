import Foundation

/// Run with swiftc alongside NearbyPlayRuntimeState.swift. The fake scheduler
/// deliberately fires cancelled tasks to model callbacks queued at suspension.
@main
struct NearbyPlayRuntimeStateTests {
    static func main() throws {
        var checks = 0
        func check(_ value: Bool, _ message: String) {
            precondition(value, message)
            checks += 1
        }

        let buffer = NearbyPlayEventBuffer()
        check(buffer.active, "Initially active")
        check(!buffer.append(["type": "data", "data": "live"]), "Active events cannot be queued")
        check(buffer.suspend(), "First inactive transition")
        check(!buffer.suspend(), "Repeated inactive transition is idempotent")
        check(buffer.append(["type": "connected"]), "Connected is retained")
        check(buffer.append(["type": "data", "data": "ack"]), "ACK is retained")
        check(buffer.append(["type": "disconnected", "reason": "peer-disconnected"]), "Disconnect is retained")
        let pending = buffer.resume()
        check(pending.compactMap { $0["type"] as? String } == ["connected", "data", "disconnected"], "FIFO includes terminal events")
        check(buffer.active && buffer.count == 0 && buffer.byteCount == 0, "Drain releases bounded storage")
        check(buffer.resume().isEmpty, "Resume never replays twice")
        buffer.suspend()
        for i in 0..<NearbyPlayEventBuffer.maxEvents {
            check(buffer.append(["type": "data", "data": "frame-\(i)"]), "Each event through the cap is accepted")
        }
        check(!buffer.append(["type": "data", "data": "overflow"]), "Event 65 is rejected")
        check(buffer.count == 64, "Rejected event is not retained")
        buffer.removeAll()
        check(!buffer.active && buffer.count == 0 && buffer.byteCount == 0, "Explicit reset preserves inactive state")
        let overhead = try JSONSerialization.data(withJSONObject: ["data": ""]).count
        let maximum = String(repeating: "x", count: NearbyPlayEventBuffer.maxBytes - overhead)
        check(buffer.append(["data": maximum]), "Exact serialized byte bound")
        check(!buffer.append(["data": ""]), "Byte capacity is enforced separately from event count")
        buffer.removeAll()
        check(!buffer.append(["data": maximum + "x"]), "Oversized single event is rejected")
        check(!buffer.append(["data": String(repeating: "あ", count: NearbyPlayEventBuffer.maxBytes / 3 + 1)]), "Bound counts UTF-8 bytes")
        check(!buffer.append(["data": Date()]), "Non-JSON bridge data is rejected")
        check(buffer.count == 0 && buffer.byteCount == 0, "Rejected input consumes no capacity")
        check(buffer.append(["type": "error", "code": "BACKGROUND_OVERFLOW"]), "Recoverable overflow signal fits after reset")
        check(buffer.append(["type": "disconnected", "reason": "BACKGROUND_OVERFLOW"]), "Disconnect fits after reset")
        check(buffer.resume().count == 2, "Overflow report remains bounded")

        var scheduled: [(seconds: TimeInterval, action: () -> Void)] = []
        var cancellations = 0
        var fired = 0
        let deadline = NearbyPlayForegroundDeadline { seconds, action in
            scheduled.append((seconds, action))
            return { cancellations += 1 }
        }
        deadline.arm(seconds: 15) { fired += 1 }
        check(scheduled.count == 1 && scheduled[0].seconds == 15, "Foreground timeout is scheduled")
        deadline.pause()
        check(cancellations == 1, "Suspending cancels the scheduled timeout")
        scheduled[0].action()
        check(fired == 0, "An already queued timeout cannot fire while inactive")
        deadline.resume()
        check(scheduled.count == 2 && scheduled[1].seconds == 15, "Resume grants a fresh progress window")
        scheduled[0].action()
        check(fired == 0, "A pre-suspension callback cannot fire after resume")
        deadline.resume()
        check(scheduled.count == 2, "Repeated resume does not extend a timeout")
        scheduled[1].action()
        scheduled[1].action()
        check(fired == 1, "Deadline action runs at most once")

        deadline.pause()
        deadline.arm(seconds: 10) { fired += 10 }
        deadline.arm(seconds: 60) { fired += 100 }
        check(scheduled.count == 2, "Background progress does not schedule work")
        deadline.resume()
        check(scheduled.count == 3 && scheduled[2].seconds == 60, "Only the latest background deadline resumes")
        deadline.cancel()
        scheduled[2].action()
        check(fired == 1, "Explicit stop invalidates queued callback")
        deadline.pause()
        deadline.resume()
        check(scheduled.count == 3, "A stopped session cannot rearm at foreground")

        deadline.arm(seconds: 1) { fired += 1 }
        deadline.arm(seconds: 2) { fired += 2 }
        scheduled[3].action()
        check(fired == 1, "Progress invalidates the old no-progress timer")
        scheduled[4].action()
        check(fired == 3, "Latest foreground deadline remains operational")

        let alice = NearbyPlayPeerFrames()
        let bob = NearbyPlayPeerFrames()
        let carol = NearbyPlayPeerFrames()
        let partial = try alice.receive(Data("{\"name\":\"あ".utf8))
        check(partial.isEmpty, "An incomplete guest frame waits only in its own buffer")
        let completeBob = try bob.receive(Data("{\"seat\":2}\n".utf8))
        check(completeBob == ["{\"seat\":2}"], "Another guest's complete frame is independently delivered")
        let completeCarol = try carol.receive(Data("{\"seat\":3}\n{\"move\":1}\n".utf8))
        check(completeCarol.count == 2, "A third guest can deliver a bounded batch")
        let completeAlice = try alice.receive(Data("\"}\n".utf8))
        check(completeAlice == ["{\"name\":\"あ\"}"], "Interleaved guests cannot splice their JSON frames")
        for index in 0..<NearbyPlayPeerFrames.maxFrames {
            try alice.enqueue(Data("{\"move\":\(index)}".utf8))
        }
        do {
            try alice.enqueue(Data("{}".utf8))
            preconditionFailure("The send cap must reject the next frame")
        } catch NearbyPlayPeerFrames.Failure.overflow { checks += 1 }
        try bob.enqueue(Data("{\"ok\":true}".utf8))
        check(bob.outgoing.count == 1 && alice.outgoing.count == 16, "A blocked guest cannot consume another queue's capacity")
        let first = alice.outgoing[0]
        alice.advance(2)
        check(alice.offset == 2 && bob.offset == 0, "Notification fragments advance only their target guest")
        alice.advance(first.count - 2)
        check(alice.offset == 0 && alice.outgoing.count == 15, "Only a fully written frame leaves its peer queue")
        do {
            _ = try carol.receive(Data("invalid\n".utf8))
            preconditionFailure("Invalid JSON must fail its peer")
        } catch NearbyPlayPeerFrames.Failure.frame { checks += 1 }
        check(bob.outgoing.count == 1 && bob.received.isEmpty, "A failing third link leaves the other links intact")
        let oversized = NearbyPlayPeerFrames()
        do {
            _ = try oversized.receive(Data(repeating: 32, count: NearbyPlayPeerFrames.maxBytes + 1))
            preconditionFailure("Oversized input must fail its peer")
        } catch NearbyPlayPeerFrames.Failure.frame { checks += 1 }
        let many = NearbyPlayPeerFrames()
        do {
            _ = try many.receive(Data(String(repeating: "{}\n", count: 17).utf8))
            preconditionFailure("A receive callback cannot exceed 16 complete frames")
        } catch NearbyPlayPeerFrames.Failure.overflow { checks += 1 }
        print("NearbyPlayRuntimeState: \(checks) checks passed")
    }
}
