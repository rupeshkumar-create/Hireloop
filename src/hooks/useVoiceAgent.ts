import { useCallback, useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

export function useVoiceAgent(enabled: boolean) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<AnyRecognition | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean((w.SpeechRecognition || w.webkitSpeechRecognition) && window.speechSynthesis));
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const listen = useCallback(
    (onResult: (transcript: string) => void) => {
      const w = window as unknown as { SpeechRecognition?: new () => AnyRecognition; webkitSpeechRecognition?: new () => AnyRecognition };
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SpeechRecognition || !enabled) return;

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onerror = () => setListening(false);
      recognition.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) onResult(transcript);
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [enabled]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, speaking, speak, stopSpeaking, listen, stopListening };
}
