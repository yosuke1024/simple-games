/**
 * Hindi catalog for Bounce Up.
 *
 * Provenance (docs/BOUNCE_UP_RULES.md §8, docs/I18N_POLICY.md「来歴」): written by
 * AI (Claude) from the English source on 2026-10-22 and **not yet read by
 * anyone** — neither the author nor a native speaker. It is not to be
 * treated as reviewed.
 *
 * The title (`bounceUpName`) is a proper noun and stays as it is in every
 * locale. Terms follow §8's glossary: platform, score, best, total.
 */
import type { BounceUpMessages } from './en';

export const hi: BounceUpMessages = {
  bounceUpName: 'Bounce Up',
  bounceUpPlay: 'चढ़ना शुरू करें',
  bounceUpBestNote: 'सर्वश्रेष्ठ {score}',
  bounceUpWidth: 'प्लेटफ़ॉर्म',
  bounceUpWidth_normal: 'सामान्य',
  bounceUpWidth_wide: 'चौड़े',
  bounceUpBest: 'सर्वश्रेष्ठ स्कोर',
  bounceUpTotal: 'कुल स्कोर',
  bounceUpBoardLabel: 'Bounce Up का बोर्ड, {state}',
  bounceUpState_ready: 'आपकी पहली चाल का इंतज़ार',
  bounceUpState_running: 'चढ़ाई जारी',
  bounceUpState_paused: 'रुका हुआ',
  bounceUpState_over: 'दौर खत्म',
  bounceUpTouchToStart: 'शुरू करने के लिए बोर्ड पर स्वाइप करें या ← → दबाएँ',
  bounceUpPaused: 'रुका हुआ',
  bounceUpPause: 'रोकें',
  bounceUpStart: 'शुरू करें',
  bounceUpClimbAgain: 'फिर से चढ़ें',
  bounceUpPad: 'चलाने के बटन',
  bounceUpMoveLeft: 'बाएँ चलें',
  bounceUpMoveRight: 'दाएँ चलें',
  bounceUpResultTitle: '{score} तक पहुँचे',
  bounceUpLiveResult: 'दौर खत्म हुआ। स्कोर {score}।',
  bounceUpStep1Title: 'स्वाइप करके चलें',
  bounceUpStep1Body:
    'बोर्ड पर उँगली बाएँ या दाएँ खिसकाएँ या ← → दबाएँ, और हर प्लेटफ़ॉर्म पर उतरते ही आप अपने-आप उछलते हैं।',
  bounceUpStep2Title: 'दोनों किनारे जुड़े हैं',
  bounceUpStep2Body:
    'एक किनारे से बाहर निकलने पर आप दूसरे किनारे से अंदर आते हैं, इसलिए ऊपर के प्लेटफ़ॉर्म तक पहुँचने में दोनों का इस्तेमाल करें।',
  bounceUpStep3Title: 'ऊँचाई ही स्कोर है',
  bounceUpStep3Body:
    'प्लेटफ़ॉर्म चूककर नीचे से गिर जाने पर दौर खत्म होता है, और जितनी ऊँचाई तक पहुँचे वही आपका स्कोर बनती है।',
};
