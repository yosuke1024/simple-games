# Nearby Multiplayer — isolated native PoC

Issue [#268](https://github.com/yosuke1024/simple-games/issues/268). **Unreleased, two devices only.**
This prepares a separate app, `com.pixapps.nearbypoc`, with BLE and same-Wi-Fi adapters,
an explicit peer-confirmation handshake, a manual 1 KB ping, and a two-player Yacht demo.
It does not add a mode, permissions, dependencies, or an entry point to the shipping app or Web version.
Do not publish this experiment as a product build.

The canonical design and official API references are in
[nearby-multiplayer.md](../../../../docs/architecture/nearby-multiplayer.md).
The real-device matrix, size gate, and outstanding Epic phases are in
[the work log](../../../../docs/plans/2026-10-25-nearby-multiplayer-poc.md).

## Check the portable protocol

From the repository root, using its pinned pnpm and installed dependencies:

```sh
pnpm install --frozen-lockfile
pnpm nearby:check
pnpm nearby:test-android
```

`nearby:check` typechecks the experiment, runs its protocol/lifecycle tests, and builds its
own `dist`. `nearby:test-android` uses Java 21 (`JAVA_HOME` or `javac`/`java` on PATH)
for native UTF-8 framing, permission-start lifecycle, and early-notification buffer tests. These are deterministic
logic tests; they cannot prove that two radios connect.

Normal native and Web builds are independent:

```sh
pnpm build
pnpm --dir apps/simple-games build:web
pnpm nearby:isolation
pnpm --dir apps/simple-games size:check
```

CI runs both sets. The isolation check rejects PoC imports/identifiers in product source
and both output directories, and rejects new Nearby permissions in the product manifests.
Keep the production network/permission and lazy-load gates intact.

## Prepare Android

Install Java 21 and Android SDK 36; configure `JAVA_HOME` and `ANDROID_HOME` as for the
normal Capacitor app. From the repository root:

```sh
pnpm nearby:prepare android
cd apps/simple-games/prototypes/nearby/android
./gradlew :app:assembleDebug --console=plain
```

The APK is `app/build/outputs/apk/debug/app-debug.apk` in that generated directory.
Install that **separate test app** on a test device through Android Studio or your normal
ADB workflow. The preparation command does not install, sign for distribution, upload,
or modify the production native project. Generated projects, builds, and logs are ignored.
Run preparation again after changes; it refreshes the web bundle and native source.

BLE requires permission only after Start. Android 24–30 scanning also needs the OS
location permission and may need Location enabled, although the app does not obtain a
location. Android 31+ uses Nearby devices permissions for the chosen radio role.
The capability probe never prompts: `availabilityKnown: false` means permission/radio
state has not been established, not that the device cannot connect.

The Android LAN experiment currently requires an existing **Wi-Fi IPv4 address** and
an on-subnet IPv4 peer. It binds sockets to that Wi-Fi network. On API 34+ it selects
the appropriate IPv4 result from NSD; API 24–33 can fail if NSD returns only an IPv6
address. Record that limitation, do not label it AP isolation or universal LAN support.

## Prepare iOS

On macOS with Xcode, from the repository root:

```sh
pnpm nearby:prepare ios
open apps/simple-games/prototypes/nearby/ios/App/App.xcodeproj
```

Select a development team for `com.pixapps.nearbypoc` and build/install on an iPhone.
The preparation script registers the Swift plugin and adds the three required usage /
Bonjour keys only to the generated app. It validates the destination identity and can be
run again. No background modes, third-party networking SDKs, or multicast entitlement
are added. See [the native iOS notes](native/ios/README.md) for unsigned build commands.
An unsigned build proves compilation, not installability or radio interoperability.

## Run two-device trials

1. Use throwaway player names. Choose the same transport on both devices. For the first
   cross-platform BLE trial choose **Advertise on iPhone, Browse on Android**. This can
   accommodate an Android device that cannot advertise. For LAN, either can advertise.
2. Choose **Game host on exactly one device**, independent of the radio role. Leave the
   other as guest. To verify independence, repeat with the game host swapped.
3. Tap Start explicitly on both, grant the chosen permissions, and select the intended
   `P-xxxxxx` / `SG-P-xxxxxx` radio label from Browse. Compare the six-digit code and player
   names on both screens. Both players must Confirm, then both must Ready.
4. Tap the 1 KB Ping button on each device and record round-trip latency. Then play
   Yacht to all 24 scored turns. Check matching dice, holds, scores, turns, final totals,
   and the Ready-for-rematch flow on both screens. Each player acts on their own turn;
   the host alone determines the random dice and authoritative scores.
5. Repeat the failure/lifecycle cases in the work log: denial, radio-off, lock/background,
   peer exit, missing WAN, and an isolated AP. Wait at least a minute while thinking to
   check that normal inactivity is not treated as a disconnection.

BLE evidence must use **airplane mode on, Bluetooth explicitly on, Wi-Fi off**, without
internet. LAN evidence must use a common router **with WAN disconnected**. Airplane
use must follow the airline/crew's instructions. No claim is made about all flights.

Discovery/advertising is bounded to 60 seconds, connection/hello to 15 seconds. Stop,
backgrounding, radio failure, malformed input, or command/ping timeout ends the session.
Native frame/queue progress has additional bounds documented in the adapters. There is
no heartbeat, reconnect loop, host migration, or persistent resume. On retry start a new
session on both devices; old commands are never replayed into a new round.

The code is sent in plaintext and is **only a wrong-peer check**, not cryptographic
authentication, encryption, or MITM protection. Do not send secrets or real personal data.
The host is trusted, including its RNG; this is not protection against a modified host.
The Japanese/English laboratory labels are not production localization or accessibility sign-off.
Diagnostics retain only the last 100 local events in memory; they are never uploaded.
Player names and scores are not added to that log. No solo saves, statistics, purchase
state, review counts, or Club House results are read or written.

## Evidence and release limitations

Record device model, exact OS/build, app commit, direction/roles, permission state,
radio/network conditions, trial counts, failures and latency in the work log. This PoC
supports only one peer. Two-device success does not establish support for four players.

Android's **+500 KB remains an unmeasured target**. Before product integration is accepted,
compare release AABs of the actual app with identical build settings and bundletool
device specs, including device install sizes. A PoC APK, a debug APK, or Web gzip cannot
substitute for that comparison. Keep Phase 1 and the Epic open until their required
physical evidence exists; production integration and expansion follow that decision.
