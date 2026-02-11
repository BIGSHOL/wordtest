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

// Preloaded audio cache: word → HTMLAudioElement (ready to play instantly)
const audioCache = new Map<string, HTMLAudioElement>();
const preloadingWords = new Set<string>();
const MAX_CACHE_SIZE = 100;

/**
 * Helper function to add items to cache with size limit (LRU-style eviction)
 */
function addToCache(cache: Map<string, HTMLAudioElement>, key: string, value: HTMLAudioElement) {
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest item (first key in Map - insertion order preserved)
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      const oldAudio = cache.get(firstKey);
      if (oldAudio && oldAudio.src.startsWith('blob:')) {
        URL.revokeObjectURL(oldAudio.src);
      }
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
}

/**
 * 백그라운드에서 Dictionary API → Gemini TTS 순서로 음원을 미리 로드
 */
export function preloadWordAudio(word: string) {
  const key = word.toLowerCase();
  if (audioCache.has(key) || preloadingWords.has(key)) return;
  preloadingWords.add(key);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`, {
    signal: controller.signal,
  })
    .then((res) => { clearTimeout(timeoutId); return res.ok ? res.json() : null; })
    .then((data) => {
      if (!data) return null;
      const audioUrl = data?.[0]?.phonetics
        ?.map((p: { audio?: string }) => p.audio)
        ?.find((url: string) => url && url.length > 0);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        addToCache(audioCache, key, audio);
        return 'done';
      }
      return null;
    })
    .then((result) => {
      // Dictionary API에 음원이 없으면 Gemini TTS로 프리로드
      if (!result && !audioCache.has(key)) {
        return fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(word)}&voice=${sessionVoice}`)
          .then((r) => r.ok ? r.blob() : null)
          .then((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.preload = 'auto';
            addToCache(audioCache, key, audio);
          });
      }
    })
    .catch(() => {})
    .finally(() => preloadingWords.delete(key));
}

/**
 * 단어 발음 재생: 프리로드된 음원 → Gemini TTS → Web Speech API
 */
export async function speakWord(word: string) {
  const key = word.toLowerCase();
  const cached = audioCache.get(key);
  if (cached) {
    cached.currentTime = 0;
    cached.play().catch(() => {});
    return;
  }

  // Gemini TTS for single word
  try {
    const resp = await fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(word)}&voice=${sessionVoice}`);
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    }
  } catch { /* fall through */ }

  // Web Speech API fallback
  speak(word, 'en-US', { rate: 0.85 });
}

/**
 * Gemini-TTS: 시험마다 랜덤 음성, 시험 중에는 동일 음성 유지
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TTS_VOICES = ['Aoede', 'Puck', 'Charon', 'Fenrir', 'Leda'];
let sessionVoice = TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];

/** 시험 시작 시 호출 — 새 랜덤 음성 배정 */
export function randomizeTtsVoice() {
  sessionVoice = TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];
}

/**
 * 전체 문항 풀 배치 프리로드 (5개씩, 300ms 간격)
 * 테스트 시작 시 호출하여 모든 후보 단어의 TTS를 사전 로드
 */
export function batchPreloadPool(
  words: { english: string; example_en?: string | null }[],
) {
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 300;
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    setTimeout(() => {
      for (const w of batch) {
        preloadWordAudio(w.english);
        if (w.example_en) preloadSentenceAudio(w.example_en);
      }
    }, (i / BATCH_SIZE) * BATCH_DELAY);
  }
}

// Sentence preload cache
const sentenceCache = new Map<string, HTMLAudioElement>();

/** 문제 표시 시 호출 — 백그라운드에서 TTS 미리 로드 */
export function preloadSentenceAudio(sentence: string) {
  if (!sentence || sentenceCache.has(sentence)) return;
  fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(sentence)}&voice=${sessionVoice}`)
    .then((r) => r.ok ? r.blob() : null)
    .then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = 'auto';
      addToCache(sentenceCache, sentence, audio);
    })
    .catch(() => {});
}

/** 문장 발음: preloaded → Gemini-TTS → Google Translate TTS → Web Speech API */
export async function speakSentence(text: string) {
  // 1) Preloaded cache (즉시 재생)
  const cached = sentenceCache.get(text);
  if (cached) {
    cached.currentTime = 0;
    await cached.play().catch(() => {});
    return;
  }

  // 2) Gemini-TTS via backend
  try {
    const resp = await fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(text)}&voice=${sessionVoice}`);
    if (resp.ok) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      return;
    }
  } catch { /* fall through */ }

  // 3) Google Translate TTS fallback
  try {
    const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
    const audio = new Audio(gttsUrl);
    await audio.play();
    return;
  } catch { /* fall through */ }

  // 4) Web Speech API fallback
  speak(text, 'en-US', { rate: 0.9 });
}

/**
 * 모든 재생 중인 사운드를 중지
 */
export function stopAllSounds() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  // Stop any playing cached audio
  for (const audio of audioCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  for (const audio of sentenceCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

/**
 * Web Speech API로 발음 (fallback용)
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
