/**
 * Text-to-Speech utility.
 * - 단어: Free Dictionary API의 원어민 녹음 음원 사용 (fallback: Web Speech API)
 * - 문장: Web Speech API에서 고품질 영어 음성 선택
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

/** 음성 목록 로딩 보장 (Chrome은 비동기) */
function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = null;
      resolve(window.speechSynthesis.getVoices());
    };
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  // 원어민 고품질 음성 우선순위: 네트워크(cloud) > 로컬
  const preferred = [
    // Chrome cloud voices
    'Google US English',
    'Google UK English Female',
    // Edge/Windows Natural voices (Neural TTS)
    'Microsoft Aria Online (Natural)',
    'Microsoft Jenny Online (Natural)',
    'Microsoft Guy Online (Natural)',
    'Microsoft Aria Online',
    'Microsoft Jenny Online',
    // macOS 고품질
    'Samantha',
    'Karen',
    'Daniel',
  ];
  for (const name of preferred) {
    const v = voices.find((voice) => voice.name.includes(name));
    if (v) { cachedVoice = v; return v; }
  }
  // 네트워크 영어 음성 선호 (품질이 높음)
  const networkEn = voices.find((v) => v.lang.startsWith('en') && !v.localService);
  if (networkEn) { cachedVoice = networkEn; return networkEn; }
  // 로컬 영어 음성
  const localEn = voices.find((v) => v.lang.startsWith('en-US'))
    || voices.find((v) => v.lang.startsWith('en'));
  if (localEn) cachedVoice = localEn;
  return localEn || null;
}

// 초기 음성 목록 로딩
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  ensureVoices();
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
  speak(word, 'en-US', { rate: 0.85 });
}

/**
 * Web Speech API로 발음 (문장용, fallback용)
 */
export function speak(
  text: string,
  lang: string = 'en-US',
  options?: { rate?: number; pitch?: number },
) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = 1.0;

  const voice = getEnglishVoice();
  if (voice) utterance.voice = voice;

  // Chrome bug: 긴 텍스트가 도중에 멈추는 문제 방지
  let resumeTimer: ReturnType<typeof setInterval> | null = null;
  if (text.length > 50) {
    resumeTimer = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        if (resumeTimer) clearInterval(resumeTimer);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);
  }

  utterance.onend = () => { if (resumeTimer) clearInterval(resumeTimer); };
  utterance.onerror = () => { if (resumeTimer) clearInterval(resumeTimer); };

  window.speechSynthesis.speak(utterance);
}
