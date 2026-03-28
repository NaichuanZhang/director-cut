"use client";

import { useState, useRef, useCallback } from "react";

// Web Speech API types (not in default lib.dom)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface RecordingResult {
  readonly type: "text" | "audio";
  readonly data: string;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    chunksRef.current = [];
    transcriptRef.current = "";
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;

    // Start speech recognition in parallel for client-side transcription
    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcriptRef.current += event.results[i][0].transcript + " ";
          }
        }
      };
      recognition.onerror = () => {
        // Silently ignore — will fall back to text input prompt
      };
      recognition.start();
      recognitionRef.current = recognition;
    }

    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    return new Promise((resolve) => {
      // Stop speech recognition
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;

      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve({ type: "text", data: "" });
        return;
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const transcript = transcriptRef.current.trim();
        if (transcript) {
          // Browser transcription succeeded — send as text
          resolve({ type: "text", data: transcript });
        } else {
          // No transcript available — convert audio to base64 fallback
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          blob.arrayBuffer().then((buffer) => {
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            resolve({ type: "audio", data: base64 });
          });
        }
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
