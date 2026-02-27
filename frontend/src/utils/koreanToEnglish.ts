/**
 * Convert Korean keyboard input (2-벌식) back to English key equivalents.
 * When Korean IME is active, typing English letters produces Korean jamo.
 * This utility reverses that mapping so typing works regardless of IME mode.
 */

const JAMO_TO_EN: Record<string, string> = {
  // Consonants (초성/종성)
  'ㄱ': 'r', 'ㄲ': 'R', 'ㄴ': 's', 'ㄷ': 'e', 'ㄸ': 'E',
  'ㄹ': 'f', 'ㅁ': 'a', 'ㅂ': 'q', 'ㅃ': 'Q', 'ㅅ': 't',
  'ㅆ': 'T', 'ㅇ': 'd', 'ㅈ': 'w', 'ㅉ': 'W', 'ㅊ': 'c',
  'ㅋ': 'z', 'ㅌ': 'x', 'ㅍ': 'v', 'ㅎ': 'g',
  // Vowels (모음)
  'ㅏ': 'k', 'ㅐ': 'o', 'ㅑ': 'i', 'ㅒ': 'O', 'ㅓ': 'j',
  'ㅔ': 'p', 'ㅕ': 'u', 'ㅖ': 'P', 'ㅗ': 'h', 'ㅘ': 'hk',
  'ㅙ': 'ho', 'ㅚ': 'hl', 'ㅛ': 'y', 'ㅜ': 'n', 'ㅝ': 'nj',
  'ㅞ': 'np', 'ㅟ': 'nl', 'ㅠ': 'b', 'ㅡ': 'm', 'ㅢ': 'ml',
  'ㅣ': 'l',
};

const INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const VOWELS = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const FINALS = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const COMPOSITE_FINALS: Record<string, string[]> = {
  'ㄳ': ['ㄱ','ㅅ'], 'ㄵ': ['ㄴ','ㅈ'], 'ㄶ': ['ㄴ','ㅎ'],
  'ㄺ': ['ㄹ','ㄱ'], 'ㄻ': ['ㄹ','ㅁ'], 'ㄼ': ['ㄹ','ㅂ'],
  'ㄽ': ['ㄹ','ㅅ'], 'ㄾ': ['ㄹ','ㅌ'], 'ㄿ': ['ㄹ','ㅍ'],
  'ㅀ': ['ㄹ','ㅎ'], 'ㅄ': ['ㅂ','ㅅ'],
};

/**
 * Convert a string containing Korean characters to their English keyboard equivalents.
 * Also passes through existing English letters. Non-letter characters are stripped.
 */
export function koreanToEnglish(text: string): string {
  let result = '';

  for (const ch of text) {
    const code = ch.charCodeAt(0);

    // Direct jamo match
    if (JAMO_TO_EN[ch]) {
      result += JAMO_TO_EN[ch];
      continue;
    }

    // Composed Hangul syllable (가-힣): decompose → initial + vowel + final
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const initial = INITIALS[Math.floor(offset / 588)];
      const vowel = VOWELS[Math.floor((offset % 588) / 28)];
      const final = FINALS[offset % 28];

      if (JAMO_TO_EN[initial]) result += JAMO_TO_EN[initial];
      if (JAMO_TO_EN[vowel]) result += JAMO_TO_EN[vowel];

      if (final) {
        if (COMPOSITE_FINALS[final]) {
          for (const j of COMPOSITE_FINALS[final]) {
            if (JAMO_TO_EN[j]) result += JAMO_TO_EN[j];
          }
        } else if (JAMO_TO_EN[final]) {
          result += JAMO_TO_EN[final];
        }
      }
      continue;
    }

    // Pass through English letters
    if (/[a-zA-Z]/.test(ch)) {
      result += ch;
    }
  }

  return result.toLowerCase();
}
