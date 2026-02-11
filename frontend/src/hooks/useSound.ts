const cache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    cache.set(src, audio);
  }
  return audio;
}

export function playSound(
  name: 'correct' | 'wrong' | 'timer' | 'two' | 'lvlup' | 'lvldown' | 'perfect',
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
