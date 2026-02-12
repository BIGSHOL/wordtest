const cache = new Map<string, HTMLAudioElement>();
let audioUnlocked = false;

function getAudio(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    cache.set(src, audio);
  }
  return audio;
}

/**
 * 모바일 오디오 잠금 해제 — 사용자 제스처(tap/click) 컨텍스트 안에서 호출해야 함.
 * 모든 효과음 Audio 요소를 무음으로 한 번 play→pause 하여
 * 이후 useEffect/setTimeout 등 비-제스처 컨텍스트에서도 재생 가능하게 함.
 */
export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  const names: Array<SoundName> = ['correct', 'wrong', 'timer', 'two', 'lvlup', 'lvldown', 'perfect'];
  for (const name of names) {
    const audio = getAudio(`/sounds/${name}.mp3`);
    const prevVol = audio.volume;
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVol;
    }).catch(() => {});
  }
}

type SoundName = 'correct' | 'wrong' | 'timer' | 'two' | 'lvlup' | 'lvldown' | 'perfect';

export function playSound(
  name: SoundName,
  options?: { volume?: number; startAt?: number },
) {
  const audio = getAudio(`/sounds/${name}.mp3`);
  audio.currentTime = options?.startAt ?? 0;
  audio.volume = options?.volume ?? 1.0;
  audio.play().catch(() => {});
}

export function stopSound(name: 'correct' | 'wrong' | 'timer' | 'two' | 'lvlup' | 'lvldown' | 'perfect') {
  const audio = cache.get(`/sounds/${name}.mp3`);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

export function stopAllSounds() {
  stopSound('timer');
  stopSound('two');
  stopSound('correct');
  stopSound('wrong');
}
