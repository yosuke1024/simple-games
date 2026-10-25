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
for native UTF-8 framing, permission-start lifecycle, early-notification buffering,
and Android NSD service-type normalization. The latest native run passed 358 checks
(165 framing, 11 lifecycle, 128 notification buffering, 54 NSD service-type checks).
These are deterministic logic tests; they cannot prove that two radios connect.

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
   candidate from Browse. Its label may be `P-xxxxxx` / `SG-P-xxxxxx`, or `SG-BLE` on iOS.
   After connecting, compare the six-digit code and player names on both screens.
   Both players must Confirm, then both must Ready.
4. Tap the 1 KB Ping button on each device and record round-trip latency. Then play
   Yacht to all 24 scored turns. Check matching dice, holds, scores, turns, final totals,
   and the Ready-for-rematch flow on both screens. Each player acts on their own turn;
   the host alone determines the random dice and authoritative scores.
5. Repeat the failure/lifecycle cases in the work log: denial, radio-off, lock/background,
   peer exit, missing WAN, and an isolated AP. Wait at least a minute while thinking to
   check that normal inactivity is not treated as a disconnection.

Discovery names are best effort. iOS falls back to `SG-BLE` when the first discovery
does not provide a usable label, and the current PoC does not update an existing
candidate's name on later discoveries. The discovery name alone does not identify
the intended player; use the post-connection name and code comparison above.
Distinguishing multiple peers and refreshing names remain product UX work.

BLE evidence must use **airplane mode on, Bluetooth explicitly on, Wi-Fi off**, without
internet. Offline LAN acceptance requires a common router **with WAN disconnected**;
record ordinary Wi-Fi trials separately without treating them as offline evidence. Airplane
use must follow the airline/crew's instructions. No claim is made about all flights.

Discovery/advertising is bounded to 60 seconds, connection/hello to 15 seconds. Stop,
backgrounding, radio failure, malformed input, or command/ping timeout ends the session.
Native frame/queue progress has additional bounds documented in the adapters. There is
no heartbeat, reconnect loop, host migration, or persistent resume. On retry start a new
session on both devices; old commands are never replayed into a new round.

Wire v2 (`418bda04`) acknowledges every host state, including the initial
and final boards. The guest validates/applies it and returns `state-ack` with matching
`stateSeq`, `round`, and `revision`. While awaiting that ACK, the host blocks further
actions/RNG/commands/Ready, shows a waiting status, and hides an unacknowledged result
and rematch. It reuses the 15-second command timer; v1 peers are rejected with a
protocol mismatch. The guest confirms its result on receiving the final state;
only the host withholds that result pending ACK, so simultaneous finalization is
not guaranteed. A duplicate command resends an already-acknowledged state with the
same `stateSeq`; while pending it produces no additional response. The implementation
passed 40 tests, typechecking, and builds, and is installed on both physical devices.
Two BLE games with the radio/game-host roles swapped (B8/B9), the L3 LAN game,
and a mid-game state-ACK timeout have been verified on the two devices.
Physical trials that drop the initial or final state/ACK are still outstanding. With no heartbeat,
silent loss during idle time is not immediately detectable: the bound starts when
the next state is sent. Record idle behavior separately from the next-action timeout.

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

On Pixel 9 Pro / iPhone 11, the recorded BLE trials completed two games with the game
host swapped; two ordinary Wi-Fi LAN trials completed one game in each direction.
Each game matched all 121 recorded public DOM boards across both devices. The first
LAN trial also confirmed session termination when iOS entered the background and no
automatic restart on return. WAN was not disconnected for these trials: offline LAN
acceptance and the remaining matrix are still open. These were wire v1 trials;
their records are kept separately from current wire v2 evidence.

The reverse LAN direction initially failed Android's resolved-peer validation.
Android commit `9b007638` fixes normalization of the leading-dot service type returned
by NSD. With that APK on Android and runtime `1131072b` still on iOS, a new trial
connected, confirmed both peers, and exchanged a ping in each direction. That game
completed all 24 turns with 121 matching boards. The initial failed trial remains in
the work log. Its raw resolved service type was not captured, so the exact failing
input is unverified.

Those games used wire v1. Its subsequent LAN failure trial exposed a missing state
acknowledgement: disabling Android's Wi-Fi ended the guest session while the iOS host
remained Confirmed with Roll enabled for over 60 seconds. The wire v2 L3 trial then
completed a new game with 121 matching boards and a successful rematch start. After
Android Wi-Fi was disabled, the next iOS Roll waited for ACK, blocked Roll/Ready,
and ended the host session after 15,009 ms on the same device clock. Both devices
stayed ended after Wi-Fi restoration. This verifies that next-action timeout in
one LAN trial; it does not establish immediate idle detection or all failure cases.

On the same wire v2 runtime, B8/B9 completed both BLE directions with 121 matching
boards each; B9 also verified a 32–32 draw and one 1 KB ping in each direction.
The trials used airplane mode on, Bluetooth on, and Wi-Fi off. B8 verified session
termination after iOS backgrounding and no restart on return; the Android disconnect
notification was not immediate and its exact delay was not measured. B9 verified
both sessions ended after Android Bluetooth was turned off, with no restart after
restoring it. Only these two devices are available; same-OS, older/non-advertising
devices, 3–4 players, and WAN-disconnected LAN remain untested. A WAN-disconnectable
router is not available. Initial/final state-ACK loss, lock, power, and full OS resource
release still need evidence.

An audited pre-integration release staging comparison estimated a download increase
of **32,983 bytes**; the AAB file itself increased by 54,185 bytes. It compares product
source with and without the native plugin, registration, permissions, and a separate
PoC HTML entry. The normal product home is unchanged, final product UX is not
integrated, and no device installation was performed. Conditions, artifacts, and
limitations are recorded in [the work log](../../../../docs/plans/2026-10-25-nearby-multiplayer-poc.md).
Android's **+500 KB gate remains unverified**. Before product integration is accepted,
compare release AABs of the actual app with identical build settings and bundletool
device specs, including device install sizes. Matching test signing keys are sufficient
for a preliminary comparison; a production release key is not a prerequisite.
`bundletool get-size total` estimates download size, not installed size, which needs
its own measurement. A PoC APK, a debug APK, or Web gzip cannot
substitute for that comparison. Keep Phase 1 and the Epic open until their required
physical evidence exists; production integration and expansion follow that decision.
