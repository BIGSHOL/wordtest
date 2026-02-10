/**
 * Text-to-Speech utility using Web Speech API.
 */
export function speak(text: string, lang: string = 'en-US') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
