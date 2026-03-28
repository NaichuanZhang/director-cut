import { GoogleGenAI } from "@google/genai";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is required");
}

export const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
