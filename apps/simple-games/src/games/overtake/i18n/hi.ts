/**
 * Hindi catalog for Overtake.
 *
 * Provenance (docs/OVERTAKE_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-21. **No native
 * speaker has read it**, nor the author; no back-translation or audit by
 * another model has been run. It is not to be treated as reviewed.
 *
 * The title (`overtakeName`) is a proper noun and stays as it is in every
 * locale.
 *
 * Terms (§12): `स्थान` for Place (never रैंक), `टक्करें` for Bumps, the
 * shell's `लेवल` for Level.
 */
import type { OvertakeMessages } from './en';

export const hi: OvertakeMessages = {
  overtakeName: 'Road Weave',

  // Home
  overtakeControls: 'नियंत्रण',
  overtakeControlsDrag: 'खींचें',
  overtakeControlsButtons: 'बटन',

  // The game screen
  overtakeStart: 'शुरू करें',
  overtakePause: 'रोकें',
  overtakeTouchToStart: 'शुरू करने के लिए छुएँ',
  overtakePaused: 'रुका हुआ',
  overtakePlaceNow: '4 में से स्थान {place}',
  overtakeBoardLabel: 'Road Weave, लेवल {n}: {state}',
  overtakeState_ready: 'तैयार',
  overtakeState_running: 'दौड़ जारी',
  overtakeState_paused: 'रुका हुआ',
  overtakeState_finished: 'पूरी हुई',
  overtakePad: 'ड्राइविंग बटन',
  overtakeSteerLeft: 'बाईं ओर मोड़ें',
  overtakeSteerRight: 'दाईं ओर मोड़ें',
  overtakeSlowDown: 'रफ़्तार कम करें',

  // The finish
  overtakeLiveResult: '4 में से स्थान {place}। टक्करें: {bumps}।',
  overtakeResultCleared: 'लेवल {n} पूरा',
  overtakeResultPlaced: 'लेवल {n} — {place}',
  overtakePlace: 'स्थान',
  overtakeBumps: 'टक्करें',

  // Quick Rules (§10)
  overtakeStep1Title: 'लेन बदलें',
  overtakeStep1Body:
    'लेन बदलने के लिए कार को बाएँ-दाएँ ले जाएँ — एक्सीलेरेटर अपने-आप चलता है, इसलिए रफ़्तार खुद बढ़ती है।',
  overtakeStep2Title: 'रफ़्तार कम करें',
  overtakeStep2BodyDrag:
    'जहाँ ट्रैफ़िक घना हो, उँगली नीचे खींचकर रफ़्तार कम करें — टक्कर आपको रोक देती है, इसलिए धीमे होना ज़्यादा तेज़ है।',
  overtakeStep2BodyHold:
    'जहाँ ट्रैफ़िक घना हो, ▼ दबाए रखकर रफ़्तार कम करें — टक्कर आपको रोक देती है, इसलिए धीमे होना ज़्यादा तेज़ है।',
  overtakeStep3Title: 'पहले पहुँचें',
  overtakeStep3Body:
    'अपनी-अपनी रफ़्तार से चल रही तीन कारों से पहले फ़िनिश लाइन पार करें, और अगला लेवल खुल जाएगा।',
};
