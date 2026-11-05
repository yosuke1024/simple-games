# Six-card-game release: 1.8.0 / 10800

The owner approved the simplified card design and explicitly requested web
publication, Google Play internal testing, and iOS TestFlight distribution.
Production App Store/Google Play rollout is outside this request.

Source branch: `codex/six-card-games`, including the `0df3d397` Nearby expansion
dependency from PR #309. Latest existing tag at preparation: `v1.7.2`.
The iOS version was set and checked as 1.8.0 / 10800 using `ios-version.mjs`.

## Release checks

- [ ] Resolve the inherited CodeQL alert on host card randomness and pass CI.
- [ ] Merge the reviewed release source with all required checks satisfied.
- [ ] Update the landing collection's game classification for 78 released,
  2 web-beta and 2 withdrawn entries; verify its publishing guards.
- [ ] Publish the exact source through the existing web workflow, retaining
  the current AdMax/analytics configuration; verify the production URL.
- [ ] Tag the release and obtain audited, signed Android AAB/APK artifacts.
- [ ] Upload and activate the Android internal-test release.
- [ ] Archive/export the matching signed iOS build with production ad settings.
- [ ] Upload to TestFlight and confirm processing/distribution status.
- [ ] Record the actual artifacts, source SHAs, versions and remaining limits.

## Security correction before distribution

PR #309's CodeQL alert #8 identifies division of a cryptographic uint32 into a
fraction, later rounded into card indices. The release replaces that host-only
path with bounded integers from rejection sampling. Shuffles receive the bound
directly; ordinary seeded CPU games retain their exact existing PRNG and shuffle
formula. Hearts' host tie choices and Old Maid's host draw choice also use the
bounded chooser. No security check is disabled or dismissed to release.

## Limits and authentication

The implementation's local validation is recorded in
`2026-11-05-six-card-games.md`. Physical Bluetooth/LAN, low-end-device checks and
independent translation review remain unperformed and must not be reported as
passed. Internal test distribution is intended to enable that verification.

Browser control failed while opening authenticated store pages. Existing App
Store Connect key files were found, but individual-key authentication returned
401 for both; no key or token was printed. The owner supplied the team-key Issuer ID; authentication then succeeded and
confirmed Simple Games (`com.pixapps.simplegames`, App Store Connect 6802321137). No store upload or
web publication has occurred at this checkpoint.

## Local security regression checks

- 52 targeted files: 476 tests passed; one Sevens UI test exceeded the 5-second
  wall-clock timeout. Its entire file passed separately (8 tests, unchanged timeout).
- TypeScript and ESLint passed for the bounded-randomness change.
- CI will run the full suite and CodeQL on the committed release source.
