import Foundation

/// swiftc NearbyPlayRuntimeState.swift NearbyPlayDiscoveryTests.swift -o <ignored build path>
@main
struct NearbyPlayDiscoveryTests {
    static func main() throws {
        var checks = 0
        func check(_ value: Bool, _ message: String) {
            precondition(value, message)
            checks += 1
        }
        func json(bytes: Int) -> Data {
            Data(("{\"x\":\"" + String(repeating: "x", count: bytes - 8) + "\"}").utf8)
        }
        let listing = "{\"v\":1,\"label\":\"P-810001\",\"name\":\"友達🦊\",\"gameId\":\"yacht\",\"protocol\":6,\"available\":true}"
        check(NearbyPlayListing.string(Data(listing.utf8)) == listing, "Preserves raw JSON and Unicode")
        check(NearbyPlayListing.string(json(bytes: 255)) != nil, "BLE accepts exact byte bound")
        check(NearbyPlayListing.string(json(bytes: 256)) == nil, "BLE rejects overflow")
        check(NearbyPlayListing.string(json(bytes: 247), lan: true) != nil, "TXT reserves key bytes")
        check(NearbyPlayListing.string(json(bytes: 248), lan: true) == nil, "TXT cannot overflow its single length byte")
        check(NearbyPlayListing.string(Data([0xff, 0xfe])) == nil, "Invalid UTF-8 is not replaced")
        check(NearbyPlayListing.string(Data()) == nil, "Absent metadata is distinct from an object")
        check(NearbyPlayListing.string(Data("[]".utf8)) == nil, "Metadata must be a JSON object")
        check(NearbyPlayListing.string(Data("{broken}".utf8)) == nil, "Malformed JSON is rejected")
        check(NearbyPlayListing.string(Data(("{\"x\":\"" + String(repeating: "😀", count: 62) + "\"}").utf8)) == nil, "Bounds count UTF-8 rather than characters")
        check(NearbyPlayListing.unavailable("{\"available\":false}"), "Explicit full room is hidden")
        check(!NearbyPlayListing.unavailable("{\"available\":0}"), "JSON numbers are not booleans")
        check(!NearbyPlayListing.unavailable("{\"available\":\"false\"}"), "Strings are not booleans")
        check(!NearbyPlayListing.unavailable(listing), "Recruiting room remains available")
        for code in 0x81...0x8d {
            check(NearbyPlayListing.supportsProbe(String(format: "P-%02x1234", code)), "All 13 new games support metadata")
        }
        for code in 1...13 {
            check(!NearbyPlayListing.supportsProbe(String(format: "F-%02x1234", code)), "Legacy game must never be probed")
        }
        for label in ["P-801234", "P-8e1234", "F-000000", "X-811234", "P-81123é", "P-8112345"] {
            check(!NearbyPlayListing.supportsProbe(label), "Invalid/reserved game code has no probe capability")
        }
        let record = NearbyPlayListing.txtRecord(json(bytes: 247))!
        check(record.count == 256 && record.first == 255, "DNS-SD length byte includes exactly listing= and data")
        check(String(data: record.dropFirst().prefix(8), encoding: .utf8) == "listing=", "TXT key is interoperable")
        check(NearbyPlayListing.txtRecord(json(bytes: 248)) == nil, "Oversized TXT is never encoded by truncation")
        check(NearbyPlayListing.txtRecord(nil) == nil, "Resume advertises no TXT listing")
        let value = json(bytes: 255)
        var reconstructed = Data()
        while reconstructed.count < value.count {
            let suffix = NearbyPlayListing.read(value, offset: reconstructed.count)!
            reconstructed.append(suffix.prefix(22))
        }
        check(reconstructed == value, "Default MTU long read reconstructs all 255 bytes")
        check(NearbyPlayListing.read(value, offset: 255)?.isEmpty == true, "End offset is an empty successful read")
        check(NearbyPlayListing.read(value, offset: 256) == nil, "Oversized offset is invalid")
        check(NearbyPlayListing.read(value, offset: -1) == nil, "Negative offset is invalid")
        check(NearbyPlayListing.read(nil, offset: 0)?.isEmpty == true, "Resume/full host yields empty metadata")

        let index = NearbyPlayDiscoveryIndex()
        for i in 0..<16 {
            check(index.observe("peer\(i)", label: "P-810001", now: 0), "Bounded candidates accepted")
        }
        check(!index.observe("overflow", label: "P-810002", now: 0), "Candidate 17 rejected")
        check(index.entries.count == 16, "Capacity does not grow on rejection")
        check(index.nextProbe(now: 0) != nil, "Fresh candidate is eligible")
        index.checked("peer0", now: 0)
        check(index.nextProbe(now: 0) != "peer0", "In-flight/failed candidate cannot monopolize discovery")
        check(index.publish("peer0", listing: listing, now: 1), "First successful probe emits")
        check(!index.publish("peer0", listing: listing, now: 2), "Identical metadata does not spam bridge")
        check(index.publish("peer0", listing: nil, now: 3), "Resume-only replacement removes the old listing")
        check(index.entries["peer0"]?.listing == nil, "No cached public room remains after empty read")
        check(index.withdraw("peer0"), "Full/failed peer is withdrawn once")
        check(!index.withdraw("peer0"), "Repeated failure does not spam lost events")
        _ = index.publish("peer1", listing: listing, now: 0)
        _ = index.observe("peer1", label: "P-810001", now: 14)
        index.checked("peer1", now: 14)
        check(index.expire(now: 15) == ["peer1"], "Advertisements and an unfinished refresh cannot renew verified metadata")
        check(index.entries.count == 1, "Expired candidates release capacity")
        check(index.entries["peer1"]?.announced == false, "Stale metadata cannot be selected")
        check(index.observe("new", label: "P-810002", now: 15), "Fresh peers enter after expiry")
        _ = index.publish("new", listing: listing, now: 15)
        _ = index.observe("new", label: "P-820003", now: 16)
        check(index.entries["new"]?.announced == false && index.entries["new"]?.listing == nil, "Changed label requires a new probe")
        check(index.nextProbe(now: 16) == "new", "Changed label is not held by old cooldown")
        index.removeAll()
        _ = index.observe("legacy", label: "P-010001", now: 0)
        _ = index.publish("legacy", listing: nil, now: 0)
        _ = index.observe("legacy", label: "P-010001", now: 14)
        check(index.nextProbe(now: 14) == nil, "Legacy discovery is passive")
        check(index.expire(now: 15).isEmpty, "Legacy presence uses advertisements only")
        check(index.expire(now: 29) == ["legacy"], "Vanished legacy peer is withdrawn")
        index.removeAll()
        check(index.entries.isEmpty && index.nextProbe(now: 30) == nil, "Stop/background reset retains no candidates")
        print("NearbyPlayDiscovery: \(checks) checks passed")
    }
}
