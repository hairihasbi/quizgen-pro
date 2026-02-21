
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";

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
    const { subject, literacyMode, questionsPerPassage, optionCount } = params;
    const isEksakta = /matematika|fisika|kimia|ipa|sains/i.test(subject);
    
    let instruction = `Anda adalah AI Pakar Kurikulum Merdeka Indonesia. Output WAJIB JSON VALID.
    
    STRUKTUR LITERASI (Wajib Patuh):
    - Mode: ${literacyMode}.
    ${literacyMode === 'Tanpa Wacana' ? '- Field "passage" HARUS bernilai NULL/KOSONG untuk SEMUA soal.' : ''}
    ${literacyMode === 'Wacana Per Soal' ? '- Setiap butir soal WAJIB memiliki teks unik di field "passage".' : ''}
    ${literacyMode === 'Wacana Per Grup' ? `- Gunakan wacana yang SAMA untuk setiap blok berisi ${questionsPerPassage} soal.` : ''}

    STRUKTUR JAWABAN:
    - Pilihan Ganda: Harus memiliki ${optionCount} opsi. Jawaban: String ("A").
    - Pilihan Ganda Kompleks: Harus memiliki ${optionCount} opsi. Jawaban: ARRAY (Contoh: ["A", "C"]). Berikan minimal 2 jawaban benar.
    - Benar/Salah: Opsi A: Benar, Opsi B: Salah. Jawaban: String ("A").
    
    MATEMATIKA:
    ${isEksakta ? '- Gunakan LaTeX: $...$ untuk inline, $$...$$ untuk block. Contoh: $\\int_{0}^{5} x dx$.' : ''}
    
    SCHEMA JSON:
    {
      "questions": [
        {
          "text": "Pertanyaan",
          "passage": "Teks wacana atau null",
          "options": [{"label":"A", "text":"Teks Opsi"}],
          "answer": "String (untuk PG) atau Array (untuk Kompleks)",
          "explanation": "Pembahasan",
          "type": "Harus sesuai jenis soal",
          "indicator": "Indikator soal",
          "cognitiveLevel": "C1-C6"
        }
      ],
      "tags": ["materi1"],
      "grid": "Kisi-kisi singkat"
    }`;
    return instruction;
  }

  async generateQuiz(params: any): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    JUMLAH OPSI: ${params.optionCount}.
    KESULITAN: ${params.difficulty}.`;

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
      throw new Error("AI Engine Gagal: " + e.message);
    }
  }

  async generateVisual(prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `High quality educational stimulus, white background: ${prompt}` }] }
      });
      
      const candidate = res.candidates?.[0];
      if (!candidate?.content?.parts) return "";

      for (const part of candidate.content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
      return "";
    } catch (e) { 
      return ""; 
    }
  }
}
