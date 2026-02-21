
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
    const { subject, questionTypes, literacyMode, questionsPerPassage, optionCount } = params;
    const isEksakta = /matematika|fisika|kimia|ipa|sains/i.test(subject);
    
    let instruction = `Anda adalah AI Pakar Kurikulum Merdeka Indonesia. Output WAJIB JSON VALID.
    
    STRUKTUR LITERASI (Wajib Dipatuhi!):
    - Mode: ${literacyMode}.
    ${literacyMode === 'Tanpa Wacana' ? '- DILARANG memberikan teks pada field "passage". Kosongkan field tersebut.' : ''}
    ${literacyMode === 'Wacana Per Soal' ? '- Setiap soal WAJIB memiliki "passage" (wacana stimulus) unik di tiap butirnya.' : ''}
    ${literacyMode === 'Wacana Per Grup' ? `- Kelompokkan soal: Tiap ${questionsPerPassage} soal berbagi wacana yang sama di field "passage".` : ''}

    STRUKTUR JAWABAN:
    - Pilihan Ganda: Harus memiliki ${optionCount} opsi (A-${String.fromCharCode(64 + optionCount)}). Jawaban: String (Contoh: "A").
    - Pilihan Ganda Kompleks: Harus memiliki ${optionCount} opsi. Jawaban: Array of String (Contoh: ["A", "C"]). Minimal 2 jawaban benar.
    - Benar/Salah: Opsi A: Benar, Opsi B: Salah. Jawaban: String.
    - Isian/Essay: Opsi kosongkan.
    
    MATEMATIKA & SIMBOL:
    ${isEksakta ? '- Gunakan LaTeX standar: $...$ untuk inline, $$...$$ untuk block. Contoh: $\\int_{0}^{5} x dx$.' : ''}
    
    SCHEMA JSON:
    {
      "questions": [
        {
          "text": "Pertanyaan",
          "passage": "Wacana (sesuai aturan literasi)",
          "options": [{"label":"A", "text":"Opsi"}],
          "answer": "Jawaban (String untuk PG, Array untuk Kompleks)",
          "explanation": "Pembahasan",
          "type": "Tipe Soal",
          "indicator": "Indikator",
          "cognitiveLevel": "C1-C6"
        }
      ],
      "tags": ["tag1"],
      "grid": "Kisi-kisi singkat"
    }`;
    return instruction;
  }

  async generateQuiz(params: any): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const system = GeminiService.getSystemInstruction(params);
    const prompt = `BUATKAN ${params.count} SOAL ${params.subject} UNTUK ${params.level} ${params.grade}.
    TOPIK: ${params.topic}. KESULITAN: ${params.difficulty}.
    TIPE SOAL YG DIIZINKAN: ${params.questionTypes.join(', ')}.
    JUMLAH OPSI: ${params.optionCount}.`;

    try {
      const response = await ai.models.generateContent({
        model: params.model || 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json"
        }
      });
      return GeminiService.extractJson(response.text || "{}");
    } catch (e: any) {
      throw new Error("AI Engine Gagal Merespons: " + e.message);
    }
  }

  async generateVisual(prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Simple educational diagram: ${prompt}` }] }
      });
      for (const part of res.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return "";
    } catch (e) { return ""; }
  }
}
