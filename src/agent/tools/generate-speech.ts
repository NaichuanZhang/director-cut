import { ai } from "@/lib/gemini";
import { MODELS, TTS_VOICE } from "@/lib/constants";
import { log } from "@/lib/logger";

export async function generateSpeech(
  sceneId: string,
  text: string,
): Promise<{ sceneId: string; audioUrl: string }> {
  log.info("generate_speech", `Generating speech for ${sceneId}`, {
    model: MODELS.TTS,
    voice: TTS_VOICE,
    textLength: text.length,
  });

  const response = await ai.models.generateContent({
    model: MODELS.TTS,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: TTS_VOICE },
        },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.[0];
  if (!audioPart?.inlineData?.data) {
    log.error("generate_speech", `No audio data in response for ${sceneId}`, {
      candidatesCount: response.candidates?.length ?? 0,
      partsCount: response.candidates?.[0]?.content?.parts?.length ?? 0,
      finishReason: response.candidates?.[0]?.finishReason,
    });
    throw new Error(`Speech generation failed for scene ${sceneId}`);
  }

  log.info("generate_speech", `Speech ready for ${sceneId}`, {
    sizeKB: Math.round((audioPart.inlineData.data.length * 0.75) / 1024),
  });

  return {
    sceneId,
    audioUrl: `data:audio/wav;base64,${audioPart.inlineData.data}`,
  };
}
