/**
 * Text-to-Speech utility.
 * - 단어: Free Dictionary API의 원어민 녹음 음원 사용 (fallback: Web Speech API)
 * - 문장: Web Speech API에서 고품질 영어 음성 선택
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  // 고품질 음성 우선순위: Google > Microsoft Online > 기타 en-US
  const preferred = [
    'Google US English',
    'Google UK English Female',
    'Google UK English Male',
    'Microsoft Aria Online',
    'Microsoft Jenny Online',
    'Samantha', // macOS
    'Karen',    // macOS
  ];
  for (const name of preferred) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) { cachedVoice = v; return v; }
  }
  const enVoice = voices.find((v) => v.lang.startsWith('en') && v.localService === false)
    || voices.find((v) => v.lang.startsWith('en'));
  if (enVoice) cachedVoice = enVoice;
  return enVoice || null;
}

// 음성 목록 로딩 (Chrome은 비동기)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
}

/**
 * 단어 발음 재생: Dictionary API 원어민 음원 → fallback: Web Speech API
 */
export async function speakWord(word: string) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      const data = await res.json();
      const audioUrl = data?.[0]?.phonetics
        ?.map((p: { audio?: string }) => p.audio)
        ?.find((url: string) => url && url.length > 0);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        await audio.play();
        return;
      }
    }
  } catch {
    // API 실패 시 fallback
  }
  speak(word);
}

/**
 * Web Speech API로 발음 (문장용, fallback용)
 */
export function speak(text: string, lang: string = 'en-US') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  const voice = getEnglishVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}
