import Foundation
#if os(macOS)
import Darwin
#endif

/// Run with swiftc alongside NearbyPlayHistoryStore.swift; uses only temporary files.
@main
struct NearbyPlayHistoryStoreTests {
    static func backupExcluded(_ url: URL) throws -> Bool {
        if try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true { return true }
        #if os(macOS)
        // On macOS a sandboxed getter may report false even though Foundation
        // wrote the Time Machine exclusion metadata. Inspect that test file only.
        let key = "com.apple.metadata:com_apple_backup_excludeItem"
        let size = getxattr(url.path, key, nil, 0, 0, 0)
        guard size > 0 else { return false }
        var data = Data(count: size)
        let count = data.withUnsafeMutableBytes { getxattr(url.path, key, $0.baseAddress, size, 0, 0) }
        guard count == size else { return false }
        return try PropertyListSerialization.propertyList(from: data, format: nil) as? String == "com.apple.backupd"
        #else
        return false
        #endif
    }

    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let directory = root.appendingPathComponent("NearbyPlay", isDirectory: true)
        let file = directory.appendingPathComponent("history.json")
        let other = root.appendingPathComponent("unrelated.json")
        let store = NearbyPlayHistoryStore(directory: directory)
        var checks = 0
        func check(_ value: Bool, _ message: String) {
            precondition(value, message)
            checks += 1
        }
        func fails(_ operation: () throws -> Void) {
            do { try operation(); preconditionFailure("Expected rejection") }
            catch { checks += 1 }
        }
        check(try store.read() == nil, "Missing history must be empty")
        try store.clear()
        check(!FileManager.default.fileExists(atPath: directory.path), "Empty reads/clears must not create history")
        try store.write("{\"message\":\"こんにちは 👋\"}")
        check(try store.read() == "{\"message\":\"こんにちは 👋\"}", "UTF-8 round trip")
        check(try backupExcluded(directory), "Directory backup exclusion")
        check(try backupExcluded(file), "File backup exclusion")
        try store.write("{\"message\":\"replacement\"}")
        check(try store.read() == "{\"message\":\"replacement\"}", "Atomic replacement")
        check(try backupExcluded(file), "Replacement preserves exclusion")
        let maximum = String(repeating: "x", count: NearbyPlayHistoryStore.maxBytes)
        try store.write(maximum)
        check(try store.read() == maximum, "Exact byte limit")
        fails { try store.write(maximum + "x") }
        fails { try store.write(String(repeating: "あ", count: NearbyPlayHistoryStore.maxBytes / 3 + 1)) }
        check(try store.read() == maximum, "Rejected writes preserve existing history")
        try Data(repeating: 120, count: NearbyPlayHistoryStore.maxBytes + 1).write(to: file)
        fails { _ = try store.read() }
        try Data([0xff]).write(to: file)
        fails { _ = try store.read() }
        try Data("other".utf8).write(to: other)
        try store.clear()
        check(try store.read() == nil, "Clear removes history")
        check(try String(contentsOf: other, encoding: .utf8) == "other", "Clear preserves unrelated data")
        try store.clear()
        try store.write("{\"fresh\":true}")
        check(try store.read() == "{\"fresh\":true}", "A later explicit write works after clear")
        print("NearbyPlayHistoryStore: \(checks) checks passed")
    }
}
