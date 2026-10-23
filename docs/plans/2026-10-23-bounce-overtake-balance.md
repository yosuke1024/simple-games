# Bounce Up / Overtake — Web beta difficulty adjustment

## Request and scope

On 2026-10-23 the product owner requested all of the following, through Web publication:

- Bounce Up: short zigzag sections, sections that actually require crossing a moving platform, and earlier difficulty progression.
- Overtake: publish the already merged relaxation in PR #259 and widen the longitudinal spacing between paired traffic rows.

The canonical behavior remains in `BOUNCE_UP_RULES.md` and `OVERTAKE_RULES.md`; this file records the delivery and validation work. These two games remain Web beta. The collection stays at 61 games, with 41 native games and 20 Web beta games.

## Starting point

- Source base: `548b87478adfead8c8ec7aac8fc946227bbc2466`, including Overtake PR #259.
- Previous production source: `3570e9d2be15bbc6f2d5db0d5001691f603c7984`, published by pixapps-landing PR #207 / merge `4874069e2d60a7b3c02acfa24676266ffd5f7e0f`.
- PR #259 was merged after the previous release build was pinned. Its side-contact relaxation and Lv11–20 density reduction have therefore not yet reached that production build.

## Acceptance

- Bounce Up exposes its first deliberate zigzag sections early, introduces required moving-platform crossings after static examples, and separates challenge sections with static resting platforms.
- The moving platform cannot be bypassed through intermediate extra platforms. Reachability is validated against actual physics and moving-platform phases, in both Normal and Wide modes.
- Overtake gives a driver time to clear the first row, react, and steer toward the second opening. The geometry does not depend on instantaneous edge-perfect steering.
- Overtake retains PR #259's mild side-scrape penalty and gentler introduction. Rival pace is recalibrated for the changed courses.
- Existing records and unlocked levels are retained; no save reset, additional controls, promotion to native, ad-policy change, or purchase change is included.
- Required source CI and the existing production publication workflow pass. The exact generated source and production delivery are recorded in the publication PR, followed by live URL verification.

## Validation and publication

### Implementation

- Bounce Up: seeded 3–5-step challenge sections begin at segment 20, followed by static rest sections. The first required moving platform appears at segment 45 or 46; the overall difficulty ramp now completes at segment 180 instead of 1500. Complete movement ranges are included in the reachability bound, and extra platforms cannot bypass the required crossing.
- Overtake: paired rows allow 250 ms reaction time, centre-to-centre steering at 440 px/s while advancing at 300 px/s, ±8 px steering tolerance, and two physics steps of margin. Clear longitudinal space grows to about 143–229 px (160 px at Lv11). Lv21 retains 15 pairs and subsequent levels add at most one per level until the existing density formula is reached. The exact driver may still pass at full speed; slowing down gives a delayed driver more time.
- The source base also includes PR #259's 0.3-second mild side-scrape penalty and Lv11–20 reduction to 6–15 pairs. All 100 rival pace entries are recalibrated for the changed courses.
- Existing saves and unlocks remain intact. Bounce Up's old best heights remain recorded, although the revised courses have a different difficulty.

### Verification

- Bounce Up: the normal Vitest configuration passed all 13 files / 123 tests. This includes four million generated segments, 400 runs reaching segment 2000, 80,000 isolated links, and 18,432 actual-physics cases sampling all 384 ticks in one period from phase zero. The independent whole-motion-range argument covers arbitrary phases; the discrete simulations are not described as exhaustive over every subpixel initial phase.
- Overtake: delayed-driver tests cover 1,479 pairs × 16 runs = 23,664 contact-free passages; all 100 courses preserve their specified pair counts, avoid fallback generation, and keep the finish margin. The 100-level pace table reproduces, including exhaustive three-rival calibration at Lv1/50/100.
- Overtake's normal suites pass 271 tests across 27 files (two opt-in calibration tests skipped), with five additional opt-in calibration checks passing. A further 5,916 cases use the actual binary brake input: hold before clearing the first row, release, and steer after a delayed reaction. All pass without contact.
- Repository-wide lint and typecheck, native and Web builds, bundle-size budgets, ad separation, and brand principles pass locally. Shared gates and required GitHub CI are recorded in the PR.
- An independent read-only review found no blocking implementation issue. The review specifically checked moving-platform bypasses, real camera/pruning behavior, first landing, reaction-time geometry, and save compatibility.
- Browser checks use the actual game engine and renderer for early zigzags, required moving crossings, and Lv11 paired rows. Normal game screens were also checked at 360 px (Bounce Up) and 320 px (Overtake), including start and pause/resume. A temporary local inspection page is excluded from the committed and published application.

Simulation establishes reachability and timing margins, not a claim of human-device testing. Required CI, publication workflow, and production verification results are recorded in the associated pull requests, so those records identify the exact tested and deployed commits.
