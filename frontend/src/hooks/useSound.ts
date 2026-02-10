const cache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    cache.set(src, audio);
  }
  return audio;
}

export function playSound(name: 'correct' | 'wrong' | 'timer' | 'two' | 'lvlup' | 'lvldown' | 'perfect') {
  const audio = getAudio(`/sounds/${name}.mp3`);
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function stopSound(name: 'correct' | 'wrong' | 'timer' | 'two' | 'lvlup' | 'lvldown' | 'perfect') {
  const audio = cache.get(`/sounds/${name}.mp3`);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
