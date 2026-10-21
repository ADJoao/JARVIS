import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const native = () => Capacitor.isNativePlatform();

// Reconhecimento de voz do navegador (Chrome), usado na versão web
type WebRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
const WebSR = (): (new () => WebRecognition) | undefined =>
  (window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => WebRecognition }).webkitSpeechRecognition;

export async function canListen(): Promise<boolean> {
  if (native()) {
    try {
      return (await SpeechRecognition.available()).available;
    } catch {
      return false;
    }
  }
  return Boolean(WebSR());
}

export class VoiceError extends Error {
  name = 'VoiceError';
}

/** Escuta o usuário e devolve o que ele falou (em português). */
export async function listen(): Promise<string> {
  if (native()) {
    let perm = await SpeechRecognition.checkPermissions();
    if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new VoiceError('Permita o uso do microfone para falar com o JARVIS.');
    // popup: usa a tela de voz do Google, que já mostra que está ouvindo e para sozinha
    const res = await SpeechRecognition.start({ language: 'pt-BR', maxResults: 1, popup: true, partialResults: false, prompt: 'Fale com o JARVIS…' });
    const text = res.matches?.[0]?.trim();
    if (!text) throw new VoiceError('Não ouvi nada. Tente de novo.');
    return text;
  }
  const SR = WebSR();
  if (!SR) throw new VoiceError('Seu navegador não suporta reconhecimento de voz.');
  return new Promise((resolve, reject) => {
    const r = new SR();
    r.lang = 'pt-BR';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let got = '';
    r.onresult = (e) => {
      got = e.results[0]?.[0]?.transcript ?? '';
    };
    r.onerror = (e) => reject(new VoiceError(e.error === 'not-allowed' ? 'Permita o uso do microfone.' : 'Não consegui ouvir. Tente de novo.'));
    r.onend = () => (got.trim() ? resolve(got.trim()) : reject(new VoiceError('Não ouvi nada. Tente de novo.')));
    r.start();
  });
}

/** Tira markdown, marcadores e emojis para a fala soar natural. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^\s*[•\-*]\s*/gm, '')
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/R\$\s?/g, 'R$ ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

let speakingId = 0;

/** Lê o texto em voz alta (voz do próprio celular, em português). */
export async function speak(text: string): Promise<void> {
  const clean = cleanForSpeech(text);
  if (!clean) return;
  const id = ++speakingId;
  if (native()) {
    try {
      await TextToSpeech.stop();
      if (id !== speakingId) return;
      await TextToSpeech.speak({ text: clean, lang: 'pt-BR', rate: 1.05, pitch: 0.95, volume: 1, category: 'playback' });
    } catch (e) {
      console.warn('Falha ao falar', e);
    }
    return;
  }
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'pt-BR';
    u.rate = 1.05;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('pt-br'));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function stopSpeaking(): Promise<void> {
  speakingId++;
  if (native()) {
    try {
      await TextToSpeech.stop();
    } catch {
      /* nada falando */
    }
  } else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
