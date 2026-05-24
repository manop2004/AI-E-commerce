import { useEffect, useRef, useState } from "react";

// Thin wrapper around the browser Web Speech API (Chrome / Edge / Safari iOS 14.5+).
export function useSpeechRecognition(lang = "th-TH") {
  const SR: any =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supported = !!SR;
  const recRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("พร้อมฟังเสียง");

  useEffect(() => {
    if (!supported) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => { setListening(true); setError(null); setStatus("เปิดไมค์แล้ว กำลังรอฟังเสียง..."); };
    rec.onaudiostart = () => setStatus("ไมค์รับเสียงแล้ว กำลังฟัง...");
    rec.onspeechstart = () => setStatus("ได้ยินเสียงพูดแล้ว กำลังถอดข้อความ...");
    rec.onspeechend = () => setStatus("หยุดพูดชั่วคราว กำลังประมวลผล...");
    rec.onresult = (e: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += `${t} `;
        else interimChunk += t;
      }
      if (finalChunk) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalChunk}`.replace(/\s+/g, " ").trim();
      }
      const next = `${finalTranscriptRef.current} ${interimChunk}`.replace(/\s+/g, " ").trim();
      setTranscript(next);
      setStatus(next ? "กำลังจับคำพูดได้แล้ว" : "กำลังฟัง...");
    };
    rec.onend = () => { setListening(false); setStatus("หยุดฟังแล้ว"); };
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
      setStatus("จับเสียงไม่ได้");
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
    setStatus("กำลังเปิดไมค์...");
    try {
      recRef.current.start();
      setListening(true);
    } catch (e: any) {
      // InvalidStateError when already started — stop and retry once
      try { recRef.current.stop(); } catch {}
      setTimeout(() => {
        try { recRef.current.start(); setListening(true); } catch (err: any) {
          setError(err?.message || "เริ่มฟังไม่ได้");
          setStatus("เริ่มฟังไม่ได้");
        }
      }, 200);
    }
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); setStatus("หยุดฟังแล้ว"); };
  const reset = () => { finalTranscriptRef.current = ""; setTranscript(""); setError(null); setStatus("พร้อมฟังเสียง"); };

  return { supported, listening, transcript, error, status, start, stop, reset, setTranscript };
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