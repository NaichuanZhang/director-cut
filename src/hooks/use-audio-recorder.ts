"use client";

import { useState, useRef, useCallback } from "react";

interface RecordingResult {
  readonly type: "text" | "audio";
  readonly data: string;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve({ type: "audio", data: "" });
        return;
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blob.arrayBuffer().then((buffer) => {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          resolve({ type: "audio", data: base64 });
        });
      };
      recorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
