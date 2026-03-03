
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
          "indicator": "Indikator soal (peserta didik dapat...)",
          "learningOutcome": "Capaian Pembelajaran (CP) yang relevan",
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
    
    // Prioritas API Key: 
    // 1. Custom Key dari Settings (jika mode eksternal)
    // 2. API_KEY (Environment variable standar platform)
    // 3. GEMINI_API_KEY (Environment variable alternatif)
    let apiKey = isExternal ? aiSettings.customApiKey : (process.env.API_KEY || process.env.GEMINI_API_KEY);
    
    // Jika mode eksternal tapi key kosong, coba fallback ke env
    if (isExternal && !apiKey) {
      apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    }

    let modelId = params.model || 'gemini-3-flash-preview';
    if (isExternal && aiSettings.targetModel) {
      modelId = aiSettings.targetModel;
    }

    if (!apiKey) {
      throw new Error("API Key tidak ditemukan. Silakan konfigurasi di menu Pengaturan.");
    }

    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    TINGKAT KESULITAN: ${params.difficulty}.
    VARIAN LEVEL: ${params.cognitiveLevels.join(', ')}.`;

    // Jika mode eksternal, gunakan fetch untuk kompatibilitas lebih luas (LiteLLM/OpenAI format)
    if (isExternal && aiSettings.baseUrl) {
      try {
        const response = await fetch(`${aiSettings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return GeminiService.extractJson(content || "{}");
      } catch (e: any) {
        console.error("[EXTERNAL_AI_ERROR]", e);
        throw new Error(`External Engine Gagal (${modelId}): ` + e.message);
      }
    }

    // Mode Native Gemini
    const ai = new GoogleGenAI({ apiKey });
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
        throw new Error("Model tidak mengembalikan teks.");
      }
      
      return GeminiService.extractJson(response.text);
    } catch (e: any) {
      console.error("[NATIVE_AI_ERROR]", e);
      throw new Error(`Native Engine Gagal (${modelId}): ` + (e.message || "Unknown Error"));
    }
  }

  async generateVisual(prompt: string): Promise<string> {
    const aiSettings = await StorageService.getAISettings();
    const isExternal = aiSettings.provider === 'external';
    
    let apiKey = isExternal ? aiSettings.customApiKey : (process.env.API_KEY || process.env.GEMINI_API_KEY);
    if (isExternal && !apiKey) {
        apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    }

    let modelId = 'gemini-3-pro-image-preview';
    if (isExternal && aiSettings.targetImageModel) {
      modelId = aiSettings.targetImageModel;
    }

    if (!apiKey) return "";

    // Visual generation biasanya spesifik Gemini, tetap gunakan SDK jika memungkinkan
    // Namun jika eksternal, kita asumsikan baseUrl mungkin tidak mendukung generateContent standar
    // Untuk saat ini, visual tetap menggunakan SDK Gemini karena format outputnya unik
    const ai = new GoogleGenAI({ apiKey } as any);

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
