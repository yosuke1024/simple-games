import Foundation

/// The JS layer owns history schema validation. This store owns a bounded,
/// device-local file and must be called only on the plugin's serial history queue.
final class NearbyPlayHistoryStore {
    static let maxBytes = 2 * 1024 * 1024
    private let directory: URL?

    // A directory override is internal and used only by the native storage tests.
    // The JavaScript API never accepts a path.
    init(directory: URL? = nil) { self.directory = directory }

    private func file(create: Bool) throws -> URL? {
        let manager = FileManager.default
        var directory = try self.directory ?? manager.url(
            for: .applicationSupportDirectory, in: .userDomainMask,
            appropriateFor: nil, create: create
        ).appendingPathComponent("NearbyPlay", isDirectory: true)
        var isDirectory: ObjCBool = false
        if !manager.fileExists(atPath: directory.path, isDirectory: &isDirectory) {
            if !create { return nil }
            try manager.createDirectory(at: directory, withIntermediateDirectories: true)
        } else if !isDirectory.boolValue {
            throw CocoaError(.fileWriteInvalidFileName)
        }
        // Exclude the directory before any temporary/atomic-write file is created.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        return directory.appendingPathComponent("history.json", isDirectory: false)
    }

    func read() throws -> String? {
        guard var file = try file(create: false), FileManager.default.fileExists(atPath: file.path) else { return nil }
        let values = try file.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true,
              let size = values.fileSize, size <= Self.maxBytes else {
            throw CocoaError(.fileReadCorruptFile)
        }
        var excluded = URLResourceValues()
        excluded.isExcludedFromBackup = true
        try file.setResourceValues(excluded)
        let data = try Data(contentsOf: file)
        guard data.count <= Self.maxBytes, let text = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return text
    }

    func write(_ text: String) throws {
        guard text.utf8.count <= Self.maxBytes, var file = try file(create: true) else {
            throw CocoaError(.fileWriteInapplicableStringEncoding)
        }
        let data = Data(text.utf8)
        try data.write(to: file, options: [.atomic, .completeFileProtection])
        // Atomic replacement creates a new file; apply exclusion to every version.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try file.setResourceValues(values)
    }

    func clear() throws {
        guard let file = try file(create: false), FileManager.default.fileExists(atPath: file.path) else { return }
        try FileManager.default.removeItem(at: file)
    }
}
