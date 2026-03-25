"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Send, Copy, Check, Volume2 } from "lucide-react";

interface TranslationResult {
  lang: string;
  langName: string;
  text: string;
}

const LANG_LABELS: Record<string, string> = {
  ko: "🇰🇷 한국어",
  en: "🇬🇧 English",
  de: "🇦🇹 Deutsch",
  cs: "🇨🇿 Čeština",
  hu: "🇭🇺 Magyar",
};

const SPEECH_LANG_MAP: Record<string, string> = {
  korean: "ko-KR",
  english: "en-US",
  german: "de-AT",
  czech: "cs-CZ",
  hungarian: "hu-HU",
};

export default function TranslatorPage() {
  const [targetCountry, setTargetCountry] = useState("austria");
  const [inputLang, setInputLang] = useState("auto");
  const [inputText, setInputText] = useState("");
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [detectedLangName, setDetectedLangName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  const translate = useCallback(
    async (text: string, lang: string) => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, detectedLang: lang, targetCountry }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
      setDetectedLangName(data.detectedLangName);
    },
    [targetCountry]
  );

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError("");
    setResults([]);
    try {
      await translate(inputText, inputLang);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "번역 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const getSpeechLang = (): string => {
    if (inputLang === "auto") return "ko-KR";
    return SPEECH_LANG_MAP[inputLang] || "ko-KR";
  };

  const startRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInputText(transcript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsRecording(false);
      if (event.error !== "aborted") {
        setError(`음성 인식 오류: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setError("");
  };

  const stopRecording = async () => {
    recognitionRef.current?.stop();
    setIsRecording(false);

    setTimeout(async () => {
      const text = document.querySelector<HTMLTextAreaElement>("textarea")?.value;
      if (text?.trim()) {
        setIsLoading(true);
        setError("");
        try {
          await translate(text, inputLang === "auto" ? "auto" : inputLang);
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "번역 실패");
        } finally {
          setIsLoading(false);
        }
      }
    }, 500);
  };

  const handleCopy = async (lang: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedLang(lang);
    setTimeout(() => setCopiedLang(null), 2000);
  };

  const handleSpeak = (text: string, lang: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      ko: "ko-KR",
      en: "en-US",
      de: "de-AT",
      cs: "cs-CZ",
      hu: "hu-HU",
    };
    utterance.lang = langMap[lang] || "en-US";
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl md:text-2xl font-bold text-slate-800">
        번역기
      </h1>

      {/* 설정 영역 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] md:text-xs text-slate-400 font-medium mb-1.5">입력 언어</label>
          <select
            value={inputLang}
            onChange={(e) => setInputLang(e.target.value)}
            className="w-full bg-white rounded-xl px-3 py-2.5 text-sm shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="auto">자동 감지</option>
            <option value="korean">🇰🇷 한국어</option>
            <option value="english">🇬🇧 English</option>
            <option value="german">🇦🇹 Deutsch</option>
            <option value="czech">🇨🇿 Čeština</option>
            <option value="hungarian">🇭🇺 Magyar</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] md:text-xs text-slate-400 font-medium mb-1.5">대상 국가</label>
          <select
            value={targetCountry}
            onChange={(e) => setTargetCountry(e.target.value)}
            className="w-full bg-white rounded-xl px-3 py-2.5 text-sm shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="austria">🇦🇹 오스트리아</option>
            <option value="czech">🇨🇿 체코</option>
            <option value="hungary">🇭🇺 헝가리</option>
          </select>
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="card p-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleTextSubmit();
            }
          }}
          placeholder="텍스트를 입력하거나 마이크 버튼을 누르세요..."
          rows={3}
          className="w-full resize-none focus:outline-none text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex gap-2">
            {speechSupported && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isRecording
                    ? "bg-red-50 text-red-600 animate-pulse"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                } disabled:opacity-50`}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                {isRecording ? "중지" : "음성"}
              </button>
            )}
          </div>
          <button
            onClick={handleTextSubmit}
            disabled={isLoading || !inputText.trim()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={14} />
            번역
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-slate-400 py-6">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          번역 중...
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 rounded-xl px-4 py-3 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* 결과 */}
      {results.length > 0 && (
        <div className="space-y-3">
          {detectedLangName && (
            <p className="text-xs text-slate-300 text-center">
              감지된 언어: <span className="text-slate-500 font-medium">{detectedLangName}</span>
            </p>
          )}
          {results.map((r) => (
            <div
              key={r.lang}
              className="card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400">
                  {LANG_LABELS[r.lang] || r.langName}
                </span>
                <div className="flex gap-0.5">
                  <button
                    onClick={() => handleSpeak(r.text, r.lang)}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-indigo-500 transition-all"
                    title="읽기"
                  >
                    <Volume2 size={14} />
                  </button>
                  <button
                    onClick={() => handleCopy(r.lang, r.text)}
                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-indigo-500 transition-all"
                    title="복사"
                  >
                    {copiedLang === r.lang ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-base leading-relaxed text-slate-800">
                {r.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      {!isLoading && results.length === 0 && !error && (
        <div className="text-center py-12 text-slate-300">
          <p className="text-4xl mb-3">🌍</p>
          <p className="text-sm font-medium">한국어 · English · Deutsch · Čeština · Magyar</p>
          <p className="text-xs mt-1.5">음성 또는 텍스트로 입력하세요</p>
        </div>
      )}
    </div>
  );
}
