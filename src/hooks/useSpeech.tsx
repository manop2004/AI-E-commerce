import { useEffect, useRef, useState } from "react";

// Thin wrapper around the browser Web Speech API (Chrome / Edge / Safari iOS 14.5+).
export function useSpeechRecognition(lang = "th-TH") {
  const SR: any =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supported = !!SR;
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    rec.onerror = (e: any) => {
      setListening(false);
      const code = e?.error || "unknown";
      const map: Record<string, string> = {
        "not-allowed": "เบราว์เซอร์ปฏิเสธไมโครโฟน — กดไอคอนกุญแจที่ URL แล้วอนุญาตไมค์",
        "service-not-allowed": "ไม่อนุญาตให้ใช้ Speech Service ในเบราว์เซอร์นี้",
        "no-speech": "ไม่ได้ยินเสียง — ลองพูดใกล้ไมค์มากขึ้น",
        "audio-capture": "ไม่พบไมโครโฟน",
        "network": "การเชื่อมต่อ Speech API ขัดข้อง",
        "aborted": "หยุดการฟัง",
      };
      setError(map[code] || `เกิดข้อผิดพลาด: ${code}`);
    };
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, supported]);

  // IMPORTANT: must be called synchronously from a user gesture (click).
  // Do NOT await getUserMedia before rec.start() — that breaks the gesture chain
  // and Chrome will silently refuse to capture audio.
  const start = () => {
    if (!recRef.current) return;
    setError(null);
    try {
      recRef.current.start();
      setListening(true);
    } catch (e: any) {
      // InvalidStateError when already started — stop and retry once
      try { recRef.current.stop(); } catch {}
      setTimeout(() => {
        try { recRef.current.start(); setListening(true); } catch (err: any) {
          setError(err?.message || "เริ่มฟังไม่ได้");
        }
      }, 200);
    }
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };
  const reset = () => { setTranscript(""); setError(null); };

  return { supported, listening, transcript, error, start, stop, reset, setTranscript };
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