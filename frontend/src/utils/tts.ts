/**
 * Text-to-Speech utility.
 * - Backend: Edge TTS (Microsoft Neural) → Gemini TTS fallback
 * - 단어: Free Dictionary API 원어민 녹음 → Backend TTS
 * - 문장: Backend TTS (Edge Neural)
 */

/** TTS 전송 전 텍스트 정리: ~ 제거, 양쪽 공백 trim */
function cleanForTts(text: string): string {
  return text.replace(/~/g, '').replace(/\s+/g, ' ').trim();
}

// Preloaded audio cache: word → HTMLAudioElement (ready to play instantly)
const audioCache = new Map<string, HTMLAudioElement>();
const preloadingWords = new Set<string>();
const MAX_CACHE_SIZE = 100;

function addToCache(cache: Map<string, HTMLAudioElement>, key: string, value: HTMLAudioElement) {
  if (cache.size >= MAX_CACHE_SIZE) {
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
 * Edge TTS voices (Microsoft Neural - 자연스러운 고품질)
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const TTS_VOICES = ['Aria', 'Jenny', 'Guy', 'Ana', 'Andrew'];
let sessionVoice = TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];

/** 백엔드 TTS 사용 불가 시 세션 내에서 플래그 설정 */
let backendTtsDown = false;
let backendFailCount = 0;

/** 시험 시작 시 호출 — 새 랜덤 음성 배정, 플래그 리셋 */
export function randomizeTtsVoice() {
  sessionVoice = TTS_VOICES[Math.floor(Math.random() * TTS_VOICES.length)];
  backendTtsDown = false;
  backendFailCount = 0;
}

/**
 * 백그라운드에서 Dictionary API → Backend TTS 순서로 음원을 미리 로드
 */
export function preloadWordAudio(word: string) {
  const cleaned = cleanForTts(word);
  const key = cleaned.toLowerCase();
  if (!key || audioCache.has(key) || preloadingWords.has(key)) return;
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
      if (!result && !audioCache.has(key) && !backendTtsDown) {
        return fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(cleaned)}&voice=${sessionVoice}`)
          .then((r) => {
            if (!r.ok) { backendFailCount++; if (backendFailCount >= 3) backendTtsDown = true; return null; }
            backendFailCount = 0;
            return r.blob();
          })
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

/** Play an HTMLAudioElement and resolve when it finishes (with safety timeout). */
function playAndWait(audio: HTMLAudioElement, timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    const done = () => { clearTimeout(timer); resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.currentTime = 0;
    audio.play().catch(done);
  });
}

/**
 * Backend TTS로 음원을 가져와서 재생. 실패 시 조용히 종료.
 */
async function playFromBackend(text: string): Promise<boolean> {
  if (backendTtsDown) return false;
  try {
    const resp = await fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(text)}&voice=${sessionVoice}`);
    if (!resp.ok) {
      backendFailCount++;
      if (backendFailCount >= 3) backendTtsDown = true;
      return false;
    }
    backendFailCount = 0;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const cleanup = () => URL.revokeObjectURL(url);
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { cleanup(); resolve(); }, 8000);
      audio.onended = () => { clearTimeout(timer); cleanup(); resolve(); };
      audio.onerror = () => { clearTimeout(timer); cleanup(); resolve(); };
      audio.play().catch(() => { clearTimeout(timer); resolve(); });
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 단어 발음 재생: 프리로드된 음원 → Backend TTS (Edge Neural)
 */
export async function speakWord(word: string): Promise<void> {
  const cleaned = cleanForTts(word);
  const key = cleaned.toLowerCase();
  const cached = audioCache.get(key);
  if (cached) {
    await playAndWait(cached);
    return;
  }
  await playFromBackend(cleaned);
}

/**
 * 전체 문항 풀 배치 프리로드 (5개씩, 300ms 간격)
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
  if (!sentence || sentenceCache.has(sentence) || backendTtsDown) return;
  fetch(`${API_BASE}/api/v1/tts?text=${encodeURIComponent(sentence)}&voice=${sessionVoice}`)
    .then((r) => {
      if (!r.ok) { backendFailCount++; if (backendFailCount >= 3) backendTtsDown = true; return null; }
      backendFailCount = 0;
      return r.blob();
    })
    .then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = 'auto';
      addToCache(sentenceCache, sentence, audio);
    })
    .catch(() => {});
}

/** 문장 발음: preloaded → Backend TTS (Edge Neural) */
export async function speakSentence(text: string) {
  // 1) Preloaded cache (즉시 재생)
  const cached = sentenceCache.get(text);
  if (cached) {
    cached.currentTime = 0;
    await cached.play().catch(() => {});
    return;
  }

  // 2) Backend TTS (Edge Neural)
  await playFromBackend(text);
}

/**
 * 모든 재생 중인 사운드를 중지
 */
export function stopAllSounds() {
  for (const audio of audioCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
  for (const audio of sentenceCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}
