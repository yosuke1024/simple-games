# iOS native source for the isolated Nearby PoC

These files belong only to the generated laboratory app, never to
`apps/simple-games/ios`. They use iOS CoreBluetooth and Network.framework;
there is no nearby-connection SDK, external server, persistence, background
mode, automatic reconnection or radio permission request during app startup.

## Registration in the generated app

From the repository root on macOS with Xcode:

```sh
pnpm nearby:prepare ios
```

The shared preparation command builds the PoC web assets, runs Capacitor
add/sync in the separate PoC directory, then calls this directory's
`prepare.mjs`. After changing only these Swift files, it can also be rerun
directly without regenerating the project:

```sh
node apps/simple-games/prototypes/nearby/native/ios/prepare.mjs
```

The iOS preparation step validates the generated project's identity and shape
before writing. It accepts only the separate `com.pixapps.nearbypoc` App
target at `prototypes/nearby/ios/App`, rejects symlinks and unexpected or
partial registrations, and performs these idempotent changes:

1. Copy `NearbyPocPlugin.swift` and `NearbyPocViewController.swift` and register
   them in the App group and Compile Sources. The generated target must have
   deployment target iOS 15.0 or later.
2. Set the bridge scene in `Main.storyboard` to `NearbyPocViewController`,
   module `App`. It registers the plugin in `capacitorDidLoad()`.
3. Merge the three keys from `Info.extra.plist` into the app's Info.plist:
   `NSBluetoothAlwaysUsageDescription`, `NSLocalNetworkUsageDescription` and
   `NSBonjourServices` containing `_sgnearby._tcp`. Do not replace its entire
   Info.plist. Do not add `UIBackgroundModes`, an ATS exception, multicast
   entitlement, device-name entitlement or a third-party SDK.

The JavaScript harness registers `NearbyPoc` and listens to `nearbyEvent` before
calling `start`. Give both devices short, distinct labels containing
letters, digits or `-` (at most 20 UTF-8 bytes); the advertised name is
`SG-<label>`. Device names, accounts and contact information are never read.

To check a device build without signing or installing it, run from the repository
root:

```sh
xcodebuild -project apps/simple-games/prototypes/nearby/ios/App/App.xcodeproj \
  -scheme App -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath apps/simple-games/prototypes/nearby/build/ios-derived \
  -clonedSourcePackagesDirPath apps/simple-games/prototypes/nearby/build/ios-packages \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```

The generated app needs its own signing settings for installation on physical
devices. Neither preparation nor this build command installs it. Compilation
cannot establish BLE peripheral support or interoperability.

## Contract and limits

`capabilities()` constructs no CoreBluetooth manager and makes no network
request. Before `start`, `bluetoothEnabled: false` is accompanied by
`availabilityKnown: false`: the radio has **not** been checked. The UI must
allow the explicit start action instead of interpreting this as unsupported
hardware. `bleSupported` / `canAdvertise` indicate the platform capability;
the actual manager state is discovered after that action. `start` resolves
when the attempt is accepted, while permission/radio/discovery failures arrive
as `error` then `disconnected` events. Permission denial or Bluetooth-off is
actionable only through an explicit user retry. Native connections are marked
`connected` when TCP is ready or the BLE notification subscription is usable;
the TypeScript peer-confirmation handshake still gates game data.

- One session and one peer at a time. At most 16 discovered peers and 16
  queued outbound frames (including a frame in flight).
  An inbound batch is validated before bridge delivery and may contain at
  most 16 complete frames.
- UTF-8 JSON text, at most 4096 bytes **before** the LF terminator. A raw LF
  inside a frame, invalid UTF-8/JSON, an empty frame or overflow closes the
  session. JSON strings containing escaped `\\n` remain valid.
- BLE uses service `9b5d1000-7a4c-4e13-a280-75d53c01a268`, central write with
  response `9b5d1001-7a4c-4e13-a280-75d53c01a268`, and peripheral notify
  `9b5d1002-7a4c-4e13-a280-75d53c01a268`. Each fragment is at most 20 bytes;
  writes wait for their response and notifications wait for CoreBluetooth
  backpressure to clear. No MTU negotiation or large-MTU assumption is needed.
  A second central subscription closes the session because CoreBluetooth
  offers no peripheral API to disconnect only that central.
  During the central's requested notification subscription, up to 4097 bytes
  of early notifications are buffered until its success callback; `connected`
  is emitted before those bytes are decoded. Unsolicited data before requesting
  subscription is rejected. iOS discovery understands Android's short label
  in service data (at most 8 UTF-8 bytes) and prefers the local name published
  by another iOS device.
- LAN publishes `_sgnearby._tcp` on an ephemeral TCP port. All parameters
  require `.wifi`, use IPv4 (`NWProtocolIP.Options.version = .v4`) and set
  `includePeerToPeer = false`. IPv6-only networks are outside this PoC.
  Only browser-discovered
  Bonjour endpoints can be selected; no manual host, remote URL or cellular
  fallback exists. A same-router network may still block device-to-device
  traffic (AP/client isolation).
  On Android API 24–33, NSD exposes only one resolved host; the possibility of
  it returning an IPv6 address for an iOS Bonjour host on a dual-stack network
  remains a physical-device verification item. IPv4 sockets alone do not prove
  which address Bonjour exposes to that older API.
- Discovery/advertising stops after 60 seconds, connection/subscription
  setup after 15 seconds, stalled outbound progress after 10 seconds, and
  an incomplete inbound frame after 15 seconds without progress. Each received
  fragment renews the last deadline. All timers are one-shot.
- `send` resolves on queue acceptance. Only the TypeScript protocol's
  acknowledgement can establish delivery. Data has no confidentiality or
  cryptographic peer authentication; use throwaway test labels and game
  messages only. Human confirmation is part of the laboratory harness.
- `stop`, app backgrounding, controller disappearance and destruction release
  scanning, advertising, listeners, sockets, GATT services, buffers and timers.
  Returning to the foreground never restarts a session.

## Verification

On 2026-10-25:

- Both Swift sources passed `xcrun swiftc -typecheck -warnings-as-errors`
  with Xcode 26.4.1, iOS 26.4 SDK and target `arm64-apple-ios15.0`.
- The generated app passed the unsigned device `xcodebuild` command above
  with Capacitor 8.4.2. The build compiled both native sources and the
  storyboard, linked the app and produced `build/ios-derived/Build/Products/
Debug-iphoneos/App.app`. Its Info.plist has the separate bundle identifier
  and the three intended permission/Bonjour keys, without background modes.
  The local build log is `build/ios-build.log` (ignored).
- `plutil -lint Info.extra.plist` passed. Running preparation twice left all
  five generated source/configuration files byte-for-byte unchanged. A copied
  fixture with the shipping bundle identifier was rejected before any write.

The first sandboxed build could not write Xcode/SwiftPM's normal user caches;
the same unsigned command succeeded with that access allowed. These checks do
not verify signing, installation, permissions, real radio behavior,
Android/iOS interoperability, battery impact or router isolation handling.
Record those separately in the shared physical-device matrix.

## Official references

- [Capacitor: custom native iOS code and registration](https://capacitorjs.com/docs/ios/custom-code)
- [Apple: central-role tasks](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/PerformingCommonCentralRoleTasks.html)
- [Apple: peripheral-role tasks and write requests](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/PerformingCommonPeripheralRoleTasks.html)
- [Apple: notification backpressure callback](<https://developer.apple.com/documentation/corebluetooth/cbperipheralmanagerdelegate/peripheralmanagerisready(toupdatesubscribers:)>)
- [Apple: required Wi-Fi interface](https://developer.apple.com/documentation/network/nwparameters/requiredinterfacetype)
- [Apple: peer-to-peer network option](https://developer.apple.com/documentation/network/nwparameters/includepeertopeer)
- [Apple: NSBonjourServices](https://developer.apple.com/documentation/bundleresources/information-property-list/nsbonjourservices)
