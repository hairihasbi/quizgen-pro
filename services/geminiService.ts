import { GoogleGenAI } from "@google/genai";
import { StorageService } from "./storageService";

export class GeminiService {
  private static extractJson(text: string): any {
    try {
      let cleaned = text.trim();

      // Check and extract codeblocks
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        cleaned = codeBlockMatch[1].trim();
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?\s*/i, "").replace(/\s*```$/, "").trim();
      }

      const startObj = cleaned.indexOf('{');
      const endObj = cleaned.lastIndexOf('}');
      const startArr = cleaned.indexOf('[');
      const endArr = cleaned.lastIndexOf(']');

      let parsed: any = null;

      if (startObj !== -1 && endObj !== -1 && (startArr === -1 || startObj < startArr)) {
        const jsonStr = cleaned.substring(startObj, endObj + 1);
        parsed = JSON.parse(jsonStr);
      } else if (startArr !== -1 && endArr !== -1) {
        const jsonStr = cleaned.substring(startArr, endArr + 1);
        parsed = { questions: JSON.parse(jsonStr) };
      } else {
        parsed = JSON.parse(cleaned);
      }

      // Normalize questions array from various potential keys
      if (!parsed.questions) {
        if (Array.isArray(parsed.soal)) parsed.questions = parsed.soal;
        else if (Array.isArray(parsed.data)) parsed.questions = parsed.data;
        else if (Array.isArray(parsed.quiz)) parsed.questions = parsed.quiz;
        else if (Array.isArray(parsed.items)) parsed.questions = parsed.items;
        else if (Array.isArray(parsed.results)) parsed.questions = parsed.results;
        else if (Array.isArray(parsed)) parsed = { questions: parsed };
        else parsed.questions = [];
      }

      // Sanitize questions
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        console.warn("[JSON_PARSE_WARN] No questions found in parsed JSON:", parsed);
        throw new Error("AI berhasil merespons tetapi tidak ditemukan butir soal yang valid dalam format JSON.");
      }

      return parsed;
    } catch (e: any) {
      console.error("[JSON_PARSE_ERROR]", e, "RAW_TEXT:", text);
      throw new Error(`Format JSON dari AI tidak valid: ${e.message}`);
    }
  }

  // Helper to clean up invalid or deprecated model names
  private static sanitizeModelName(modelName: string): string {
    if (!modelName) return 'gemini-2.5-flash';
    let clean = modelName.trim();
    if (clean.includes('gemini-3')) {
      clean = clean.replace(/gemini-3-flash-preview|gemini-3-pro-preview|gemini-3-[a-z0-9-]+/gi, 'gemini-2.5-flash');
    }
    return clean;
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

  // Method for calling Native Gemini SDK with a single key
  private static async executeGeminiCall(
    apiKey: string,
    modelId: string,
    system: string,
    prompt: string
  ): Promise<any> {
    const cleanModel = GeminiService.sanitizeModelName(modelId);
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: cleanModel,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) {
      throw new Error("Model Gemini tidak mengembalikan respon teks.");
    }

    return GeminiService.extractJson(response.text);
  }

  async generateQuiz(params: any): Promise<any> {
    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    TINGKAT KESULITAN: ${params.difficulty}.
    VARIAN LEVEL: ${params.cognitiveLevels.join(', ')}.`;

    const modelId = params.model || 'gemini-2.5-flash';

    // Retrieve active API keys from the dedicated Rotating API Management pool
    const allKeys = await StorageService.getApiKeys();
    const activeKeys = allKeys.filter(k => k.isActive && k.key && k.key.trim().length > 5);

    // Sort active keys by errorCount ascending and usageCount ascending (load balancing)
    const sortedKeys = [...activeKeys].sort((a, b) => (a.errorCount - b.errorCount) || (a.usageCount - b.usageCount));

    let lastError: any = null;

    // Try keys from the dedicated Rotating API Management pool
    for (const keyItem of sortedKeys) {
      try {
        console.log(`[AI_CLUSTER] Memanggil node API Key (${keyItem.key.substring(0, 8)}...)...`);
        const result = await GeminiService.executeGeminiCall(keyItem.key, modelId, system, prompt);
        
        // Success: record hit in pool metrics
        await StorageService.incrementApiKeyUsage(keyItem.key);
        return result;
      } catch (err: any) {
        console.warn(`[AI_CLUSTER_WARN] Node (${keyItem.key.substring(0, 8)}...) gagal: ${err.message}`);
        await StorageService.reportApiKeyError(keyItem.id);
        lastError = err;
      }
    }

    // Fallback to environment variable key if pool failed or empty
    const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (envKey) {
      try {
        console.log(`[AI_CLUSTER] Mencoba default environment API Key...`);
        return await GeminiService.executeGeminiCall(envKey, modelId, system, prompt);
      } catch (err: any) {
        lastError = err;
      }
    }

    if (sortedKeys.length === 0 && !envKey) {
      throw new Error("Belum ada API Key Gemini yang aktif. Silakan buka menu 'API Keys' pada sidebar untuk menambahkan API Key Gemini Anda.");
    }

    throw new Error(lastError?.message || "Seluruh node API Key dalam pool mengalami kegagalan. Silakan periksa status key pada menu 'API Keys'.");
  }

  async generateVisual(prompt: string): Promise<string> {
    const allKeys = await StorageService.getApiKeys();
    const activeKeys = allKeys.filter(k => k.isActive && k.key && k.key.trim().length > 5);
    const apiKey = activeKeys[0]?.key || process.env.API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) return "";

    const modelId = 'gemini-2.5-flash';

    try {
      const ai = new GoogleGenAI({ apiKey } as any);
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
      console.warn("[GENERATE_VISUAL_WARNING] Visual generation failed, proceeding without image:", e);
      return ""; 
    }
  }
}
