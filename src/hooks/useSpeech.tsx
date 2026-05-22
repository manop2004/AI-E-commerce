import { useEffect, useRef, useState } from "react";

// Thin wrapper around the browser Web Speech API (Chrome / Edge / Safari iOS 14.5+).
// Returns { supported, listening, transcript, start, stop, reset }
export function useSpeechRecognition(lang = "th-TH") {
  const SR: any =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supported = !!SR;
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    if (!supported) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      setTranscript((prev) => (final ? prev + final : prev.replace(/\s*\(…\).*$/, "") + (interim ? " (…)" + interim : "")));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, supported]);

  const start = () => {
    if (!recRef.current) return;
    try { recRef.current.start(); setListening(true); } catch {}
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };
  const reset = () => setTranscript("");

  return { supported, listening, transcript, start, stop, reset, setTranscript };
}

export function speak(text: string, lang = "th-TH") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {}
}