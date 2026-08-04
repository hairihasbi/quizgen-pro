
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

  // Method for calling OpenAI or LiteLLM endpoints (/chat/completions)
  private static async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    system: string,
    prompt: string
  ): Promise<any> {
    if (!baseUrl) {
      throw new Error("Base URL endpoint OpenAI/LiteLLM belum dikonfigurasi.");
    }

    const cleanBaseUrl = baseUrl.replace(/\/$/, '').replace(/\/chat\/completions$/, '');
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body: any = {
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    // If 400 Bad Request occurs (some LiteLLM proxies or older model backends don't accept response_format), retry without it
    if (!response.ok && response.status === 400) {
      delete body.response_format;
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || errData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Response OpenAI/LiteLLM tidak berisi konten.");
    }

    return GeminiService.extractJson(content);
  }

  // Method for calling Native Gemini SDK
  private static async callNativeGemini(
    apiKey: string,
    modelId: string,
    system: string,
    prompt: string
  ): Promise<any> {
    if (!apiKey) {
      throw new Error("Google Gemini API Key tidak ditemukan.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: modelId || 'gemini-2.5-flash',
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
    const aiSettings = await StorageService.getAISettings();
    const isExternalPrimary = aiSettings.provider === 'external';

    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    TINGKAT KESULITAN: ${params.difficulty}.
    VARIAN LEVEL: ${params.cognitiveLevels.join(', ')}.`;

    const nativeApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || aiSettings.customApiKey || '';
    const primaryGeminiModel = params.model || aiSettings.targetModel || 'gemini-2.5-flash';

    if (isExternalPrimary) {
      // Primary: LiteLLM / OpenAI
      const primaryBaseUrl = aiSettings.baseUrl || process.env.LITELLM_BASE_URL || 'https://api.openai.com/v1';
      const primaryApiKey = aiSettings.customApiKey || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || nativeApiKey || '';
      const model = aiSettings.targetModel || 'gpt-4o-mini';

      try {
        console.log(`[AI_ENGINE] Menggunakan Primary External Engine (${model} @ ${primaryBaseUrl})...`);
        return await GeminiService.callOpenAICompatible(primaryBaseUrl, primaryApiKey, model, system, prompt);
      } catch (primaryErr: any) {
        console.warn(`[AI_ENGINE_WARNING] Primary External Engine Error: ${primaryErr.message}`);

        // Try Fallback to Native Gemini
        if (nativeApiKey) {
          try {
            console.log(`[AI_ENGINE] Mencoba Fallback ke Native Gemini Engine (${primaryGeminiModel})...`);
            return await GeminiService.callNativeGemini(nativeApiKey, primaryGeminiModel, system, prompt);
          } catch (fallbackErr: any) {
            throw new Error(`External Engine Gagal (${primaryErr.message}) & Fallback Gemini Native Gagal (${fallbackErr.message})`);
          }
        } else {
          throw new Error(`External Engine Gagal (${model}): ${primaryErr.message}`);
        }
      }
    } else {
      // Primary: Native Gemini
      try {
        console.log(`[AI_ENGINE] Menggunakan Primary Native Gemini Engine (${primaryGeminiModel})...`);
        return await GeminiService.callNativeGemini(nativeApiKey, primaryGeminiModel, system, prompt);
      } catch (primaryErr: any) {
        console.warn(`[AI_ENGINE_WARNING] Primary Gemini Error: ${primaryErr.message}`);

        // Check if Fallback OpenAI / LiteLLM is configured
        const fallbackBaseUrl = aiSettings.fallbackBaseUrl || aiSettings.baseUrl || process.env.LITELLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const fallbackApiKey = aiSettings.fallbackApiKey || aiSettings.customApiKey || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || '';
        const fallbackModel = aiSettings.fallbackModel || 'gpt-4o-mini';
        const isFallbackEnabled = aiSettings.enableFallback !== false;

        if (isFallbackEnabled && (fallbackApiKey || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY)) {
          try {
            console.log(`[AI_ENGINE] Mencoba Fallback ke OpenAI/LiteLLM Engine (${fallbackModel} @ ${fallbackBaseUrl})...`);
            return await GeminiService.callOpenAICompatible(fallbackBaseUrl, fallbackApiKey, fallbackModel, system, prompt);
          } catch (fallbackErr: any) {
            throw new Error(`Gemini Primary Gagal (${primaryErr.message}) & Fallback OpenAI/LiteLLM Gagal (${fallbackErr.message})`);
          }
        } else {
          throw new Error(`Gemini Engine Gagal (${primaryGeminiModel}): ${primaryErr.message}. (Tips: Konfigurasi Fallback OpenAI/LiteLLM di Pengaturan Situs agar otomatis dialihkan)`);
        }
      }
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
