
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";
import { StorageService } from "./storageService";

export class GeminiService {
  private static extractJson(text: string): any {
    try {
      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?\s*/, "").replace(/\s*```$/, "");
      }
      const startIdx = cleaned.indexOf('{');
      const endIdx = cleaned.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
      }
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("[JSON_PARSE_ERROR]", e);
      return { questions: [], tags: [], grid: "" };
    }
  }

  private static getSystemInstruction(params: any): string {
    const { subject, literacyMode, questionsPerPassage, optionCount, cognitiveLevels } = params;
    const isEksakta = /matematika|fisika|kimia|ipa|sains/i.test(subject);
    
    let instruction = `Anda adalah AI Pakar Kurikulum Merdeka Indonesia. Output WAJIB JSON VALID.
    
    ATURAN LEVEL KOGNITIF:
    - Distribusikan soal sesuai level yang dipilih user: ${cognitiveLevels.join(', ')}.
    - Berikan indikator pencapaian kompetensi yang spesifik untuk tiap butir.

    STRUKTUR LITERASI:
    - Mode: ${literacyMode}.
    ${literacyMode === 'Tanpa Wacana' ? '- Field "passage" HARUS bernilai NULL untuk SEMUA soal.' : ''}
    ${literacyMode === 'Wacana Per Soal' ? '- Setiap butir soal WAJIB memiliki teks wacana unik.' : ''}
    ${literacyMode === 'Wacana Per Grup' ? `- Gunakan wacana yang SAMA untuk setiap blok berisi ${questionsPerPassage} soal.` : ''}

    ATURAN JAWABAN:
    - Pilihan Ganda: Harus memiliki ${optionCount} opsi. Jawaban: String ("A").
    - Pilihan Ganda Kompleks: Harus memiliki ${optionCount} opsi. Jawaban: ARRAY (Contoh: ["A", "C"]). Berikan minimal 2 jawaban benar.
    
    MATEMATIKA:
    ${isEksakta ? '- Gunakan LaTeX: $...$ untuk inline, $$...$$ untuk block.' : ''}
    
    SCHEMA JSON:
    {
      "questions": [
        {
          "text": "Pertanyaan",
          "passage": "Teks wacana atau null",
          "options": [{"label":"A", "text":"Teks"}],
          "answer": "String atau Array",
          "explanation": "Pembahasan",
          "type": "Jenis soal",
          "indicator": "Tujuan/indikator soal",
          "cognitiveLevel": "Tingkatan Bloom"
        }
      ],
      "tags": ["tag"],
      "grid": "Matriks kisi-kisi"
    }`;
    return instruction;
  }

  async generateQuiz(params: any): Promise<any> {
    const aiSettings = await StorageService.getAISettings();
    const isExternal = aiSettings.provider === 'external';
    
    // Gunakan GEMINI_API_KEY sebagai default sesuai standar platform
    let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    let baseUrl = undefined;
    let modelId = params.model || 'gemini-3-flash-preview';

    if (isExternal) {
      // Jika eksternal, prioritaskan key dari settings
      apiKey = aiSettings.customApiKey || apiKey;
      baseUrl = aiSettings.baseUrl;
      modelId = aiSettings.targetModel || modelId;
    }

    if (!apiKey) {
      throw new Error("API Key tidak ditemukan. Silakan konfigurasi di menu Pengaturan atau periksa environment variable.");
    }

    const options: any = { apiKey };
    if (isExternal && baseUrl) {
      options.baseUrl = baseUrl;
    }

    const ai = new GoogleGenAI(options);
    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    TINGKAT KESULITAN: ${params.difficulty}.
    VARIAN LEVEL: ${params.cognitiveLevels.join(', ')}.`;

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json"
        }
      });
      
      if (!response.text) {
        throw new Error("Model tidak mengembalikan teks. Periksa konfigurasi API Key atau Model ID.");
      }
      
      return GeminiService.extractJson(response.text);
    } catch (e: any) {
      console.error("[GENERATE_QUIZ_ERROR]", e);
      // Jika error mengandung pesan API key invalid, berikan saran yang lebih jelas
      const errorMsg = e.message || "Unknown Error";
      if (errorMsg.includes("API key not valid") || errorMsg.includes("400")) {
        throw new Error(`Koneksi Gagal: API Key tidak valid atau Model ID (${modelId}) tidak didukung oleh provider.`);
      }
      throw new Error(`AI Engine Gagal (${modelId}): ` + errorMsg);
    }
  }

  async generateVisual(prompt: string): Promise<string> {
    const aiSettings = await StorageService.getAISettings();
    const isExternal = aiSettings.provider === 'external';
    
    let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    let baseUrl = undefined;
    let modelId = 'gemini-3-pro-image-preview';

    if (isExternal) {
      apiKey = aiSettings.customApiKey || apiKey;
      baseUrl = aiSettings.baseUrl;
      modelId = aiSettings.targetImageModel || modelId;
    }

    if (!apiKey) return "";

    const options: any = { apiKey };
    if (isExternal && baseUrl) {
      options.baseUrl = baseUrl;
    }

    const ai = new GoogleGenAI(options);

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: `A clean, high-contrast educational illustration for classroom test. Black and white or simple colors. Minimalist style. Content: ${prompt}` }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });
      
      if (!response.candidates?.[0]?.content?.parts) return "";

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return "";
    } catch (e) { 
      console.error("[GENERATE_VISUAL_ERROR]", e);
      return ""; 
    }
  }
}
