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
        let listing = "{\"v\":2,\"label\":\"P-810001\",\"roomName\":\"週末のゲーム🦊\",\"gameId\":\"yacht\",\"protocol\":7,\"available\":true}"
        check(NearbyPlayListing.string(Data(listing.utf8)) == listing, "Preserves raw JSON and Unicode")
        let longestRoom = String(repeating: "🦊", count: 24)
        let longestListing = "{\"v\":2,\"label\":\"P-8B0001\",\"roomName\":\"\(longestRoom)\",\"gameId\":\"nested-tic-tac-toe\",\"protocol\":7,\"available\":true}"
        let longestData = Data(longestListing.utf8)
        check(longestData.count <= NearbyPlayListing.maxTXTBytes, "Maximum Unicode room name and game ID fit one TXT item")
        check(NearbyPlayListing.string(longestData, lan: true) == longestListing, "LAN preserves the new room listing at its maximum name size")
        check(NearbyPlayListing.txtRecord(longestData)?.dropFirst(9) == longestData, "TXT preserves the v2 listing without truncating the room name")
        var roomFragments = Data()
        while roomFragments.count < longestData.count {
            roomFragments.append(NearbyPlayListing.read(longestData, offset: roomFragments.count)!.prefix(22))
        }
        check(NearbyPlayListing.string(roomFragments) == longestListing, "Default MTU long reads preserve a Unicode v2 room name across fragment boundaries")
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
        for code in 0x81...0x8e {
            check(NearbyPlayListing.supportsProbe(String(format: "P-%02x1234", code)), "All 14 new games support metadata")
        }
        for code in 1...13 {
            check(!NearbyPlayListing.supportsProbe(String(format: "F-%02x1234", code)), "Legacy game must never be probed")
        }
        for label in ["P-801234", "P-8f1234", "F-000000", "X-811234", "P-81123é", "P-8112345"] {
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

        // Multi-seat recruiting: the JS flag only ANDs with the link-count rule.
        let room = Data(listing.utf8)
        check(NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 0, limit: 3) == room, "Empty visible room publishes its listing")
        check(NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 2, limit: 3) == room, "Visible room with a free seat publishes its listing")
        check(NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 3, limit: 3) == nil, "Full room publishes nothing, as before")
        check(NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 4, limit: 3) == nil, "Over-full room publishes nothing")
        check(NearbyPlayListing.advertised(listing: room, hidden: true, occupied: 0, limit: 3) == nil, "Hidden room with free seats publishes nothing")
        check(NearbyPlayListing.advertised(listing: room, hidden: true, occupied: 3, limit: 3) == nil, "Hidden full room publishes nothing")
        check(NearbyPlayListing.advertised(listing: nil, hidden: false, occupied: 0, limit: 3) == nil, "Resume host has no listing to publish")
        check(NearbyPlayListing.advertised(listing: nil, hidden: true, occupied: 0, limit: 3) == nil, "Hidden resume host still has none")
        // Hiding withdraws the listing from both channels without an empty value.
        let shown = NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 1, limit: 3)
        let hiddenListing = NearbyPlayListing.advertised(listing: room, hidden: true, occupied: 1, limit: 3)
        check(NearbyPlayListing.txtRecord(shown)?.dropFirst(9) == room, "Visible room publishes the listing TXT item")
        check(NearbyPlayListing.txtRecord(hiddenListing) == nil, "Hidden room has no TXT item at all, not an empty one")
        check(NearbyPlayListing.txtRecord(Data()) == nil, "An empty listing is never encoded as a TXT item")
        check(NearbyPlayListing.read(shown, offset: 0) == room, "Visible room serves its metadata")
        check(NearbyPlayListing.read(hiddenListing, offset: 0)?.isEmpty == true, "Hidden room answers metadata with a successful empty read")
        check(NearbyPlayListing.read(hiddenListing, offset: 0) == NearbyPlayListing.read(nil, offset: 0), "Hidden reads exactly like a full room")
        check(NearbyPlayListing.txtRecord(hiddenListing) == NearbyPlayListing.txtRecord(nil), "Hidden TXT equals the full-room TXT")
        // Resuming recruitment restores the same bytes, so the dedupe key is stable.
        let resumed = NearbyPlayListing.advertised(listing: room, hidden: false, occupied: 1, limit: 3)
        check(NearbyPlayListing.txtRecord(resumed) == NearbyPlayListing.txtRecord(shown), "Hide then show restores the identical TXT bytes")
        check(NearbyPlayListing.txtRecord(hiddenListing) != NearbyPlayListing.txtRecord(shown), "Hidden and visible TXT differ, so a change re-registers once")

        // The host's listing state, as the plugin drives it: a fresh start, the
        // JS switch, and links coming and going. Seats are `occupied` of 3.
        let roomTXT = NearbyPlayListing.txtRecord(room)
        check(roomTXT != nil, "Fixture listing is TXT-encodable")
        check(NearbyPlayHostListing.isMultiSeatHost(peerLimit: 3, role: "advertise"), "Three-seat advertiser is a multi-seat host")
        check(NearbyPlayHostListing.isMultiSeatHost(peerLimit: 2, role: "advertise"), "Any advertiser with more than one seat is a multi-seat host")
        check(!NearbyPlayHostListing.isMultiSeatHost(peerLimit: 1, role: "advertise"), "Two-player host rejects setListingVisible")
        check(!NearbyPlayHostListing.isMultiSeatHost(peerLimit: 3, role: "browse"), "Browse session rejects setListingVisible")
        check(!NearbyPlayHostListing.isMultiSeatHost(peerLimit: 1, role: "browse"), "Two-player browse session rejects setListingVisible")
        check(!NearbyPlayHostListing.isMultiSeatHost(peerLimit: 3, role: ""), "A stopped session has no role and rejects setListingVisible")

        var host = NearbyPlayHostListing()
        check(!host.hidden, "A fresh host recruits")
        check(host.register(listing: room, occupied: 0, limit: 3) == roomTXT, "A new listener registers the listing")
        check(host.refresh(listing: room, occupied: 1, limit: 3) == .unchanged, "A guest joining a visible room with a free seat changes nothing")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .unchanged, "The next guest joining changes nothing either")
        check(host.refresh(listing: room, occupied: 3, limit: 3) == .register(nil), "A full room withdraws the TXT item")
        check(NearbyPlayListing.read(host.published(listing: room, occupied: 3, limit: 3), offset: 0)?.isEmpty == true, "A full room answers BLE metadata with a successful empty read")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .register(roomTXT), "A seat freeing publishes the listing again")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .unchanged, "Refreshing again with identical bytes never re-registers")

        // Match start: hide with free seats.
        host.setVisible(false)
        check(host.hidden, "setListingVisible(false) hides")
        check(host.published(listing: room, occupied: 2, limit: 3) == nil, "A hidden room publishes nothing to BLE")
        check(NearbyPlayListing.read(host.published(listing: room, occupied: 2, limit: 3), offset: 0)?.isEmpty == true, "A hidden room answers BLE metadata with a successful empty read")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .register(nil), "Hiding withdraws the TXT item, never an empty one")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .unchanged, "A repeated hide does not re-register")
        // A guest's link drops mid-match: it must stay invisible to browsers.
        check(host.refresh(listing: room, occupied: 1, limit: 3) == .unchanged, "A link dropping while hidden does not re-register")
        check(host.refresh(listing: room, occupied: 0, limit: 3) == .unchanged, "Every link dropping while hidden still does not re-register")
        check(host.published(listing: room, occupied: 0, limit: 3) == nil, "Free seats do not unhide a hidden room")
        // Between matches: show.
        host.setVisible(true)
        check(!host.hidden, "setListingVisible(true) resumes recruiting")
        check(host.refresh(listing: room, occupied: 0, limit: 3) == .register(roomTXT), "Showing publishes the listing exactly once")
        check(host.refresh(listing: room, occupied: 0, limit: 3) == .unchanged, "A repeated show does not re-register")

        // Show while full: the JS flag only ANDs with the link count.
        check(host.refresh(listing: room, occupied: 3, limit: 3) == .register(nil), "The room fills while visible")
        host.setVisible(false)
        check(host.refresh(listing: room, occupied: 3, limit: 3) == .unchanged, "Hiding a full room changes nothing on the wire")
        host.setVisible(true)
        check(host.published(listing: room, occupied: 3, limit: 3) == nil, "Showing a full room publishes nothing to BLE")
        check(host.refresh(listing: room, occupied: 3, limit: 3) == .unchanged, "Showing a full room publishes nothing to Bonjour")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .register(roomTXT), "The seat freeing after a show-while-full publishes exactly once")
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .unchanged, "And only once")

        // Hide, then the room fills and empties while hidden: still nothing until shown.
        host.setVisible(false)
        check(host.refresh(listing: room, occupied: 2, limit: 3) == .register(nil), "Hide again with a free seat")
        check(host.refresh(listing: room, occupied: 3, limit: 3) == .unchanged, "A hidden room filling changes nothing")
        check(host.refresh(listing: room, occupied: 1, limit: 3) == .unchanged, "A hidden room emptying changes nothing")

        // A fresh start always begins visible and re-registers, whatever came before.
        check(host.hidden, "The host is hidden before the restart")
        host.reset()
        check(!host.hidden, "A fresh start() always begins visible")
        check(host.published(listing: room, occupied: 0, limit: 3) == room, "A restarted host publishes its listing")
        check(host.register(listing: room, occupied: 0, limit: 3) == roomTXT, "A restarted listener registers the listing")
        check(host.refresh(listing: room, occupied: 0, limit: 3) == .unchanged, "The restarted listener starts from its own record")

        // A stop forgets what was registered: the next listener is never skipped.
        host.reset()
        check(host.refresh(listing: room, occupied: 0, limit: 3) == .register(roomTXT), "Refreshing before any registration registers rather than skipping")

        // A resume host has no listing: nothing to publish or hide, and one registration only.
        var resumeHost = NearbyPlayHostListing()
        check(resumeHost.register(listing: nil, occupied: 0, limit: 3) == nil, "A resume host registers no TXT item")
        resumeHost.setVisible(false)
        check(resumeHost.refresh(listing: nil, occupied: 0, limit: 3) == .unchanged, "Hiding a resume host changes nothing")
        resumeHost.setVisible(true)
        check(resumeHost.refresh(listing: nil, occupied: 0, limit: 3) == .unchanged, "Showing a resume host publishes nothing")
        check(resumeHost.published(listing: nil, occupied: 0, limit: 3) == nil, "A resume host never publishes a listing")

        // A listing too long for one TXT item is never encoded, hidden or not.
        let longBLE = json(bytes: 255)
        var longHost = NearbyPlayHostListing()
        check(longHost.published(listing: longBLE, occupied: 0, limit: 3) == longBLE, "BLE still publishes a listing that is too long for TXT")
        check(longHost.register(listing: longBLE, occupied: 0, limit: 3) == nil, "An oversized listing has no TXT item")
        longHost.setVisible(false)
        check(longHost.refresh(listing: longBLE, occupied: 0, limit: 3) == .unchanged, "Hiding an oversized listing changes nothing on Bonjour")
        check(longHost.published(listing: longBLE, occupied: 0, limit: 3) == nil, "Hiding an oversized listing still withdraws it from BLE")

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
