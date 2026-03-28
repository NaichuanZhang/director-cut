import { ai } from "@/lib/gemini";
import { MODELS, TTS_VOICE } from "@/lib/constants";

export async function generateSpeech(
  sceneId: string,
  text: string,
): Promise<{ sceneId: string; audioUrl: string }> {
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
    throw new Error(`Speech generation failed for scene ${sceneId}`);
  }

  return {
    sceneId,
    audioUrl: `data:audio/wav;base64,${audioPart.inlineData.data}`,
  };
}
