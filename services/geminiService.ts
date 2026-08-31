
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType, AISettings } from "../types";
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
  private static sanitizeModelName(modelName: string, isExternal: boolean): string {
    if (!modelName) {
      return isExternal ? 'gpt-4o-mini' : 'gemini-2.5-flash';
    }
    let clean = modelName.trim();
    if (clean.includes('gemini-3')) {
      clean = clean.replace(/gemini-3-flash-preview|gemini-3-pro-preview|gemini-3-[a-z0-9-]+/gi, isExternal ? 'gpt-4o-mini' : 'gemini-2.5-flash');
    }
    return clean;
  }

  // Native Gemini Key: explicit geminiApiKey or provider customApiKey or process.env
  private static getNativeGeminiKey(aiSettings: any): string {
    if (aiSettings.geminiApiKey) {
      return aiSettings.geminiApiKey;
    }
    if (aiSettings.provider === 'native' && aiSettings.customApiKey) {
      return aiSettings.customApiKey;
    }
    return process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  }

  // Primary External Key (LiteLLM / OpenAI):
  private static getExternalPrimaryKey(aiSettings: any): string {
    if (aiSettings.provider === 'external' && aiSettings.customApiKey) {
      return aiSettings.customApiKey;
    }
    return process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || '';
  }

  // Fallback External Key (LiteLLM / OpenAI):
  private static getExternalFallbackKey(aiSettings: any): string {
    if (aiSettings.fallbackApiKey) {
      return aiSettings.fallbackApiKey;
    }
    if (aiSettings.provider === 'external' && aiSettings.customApiKey) {
      return aiSettings.customApiKey;
    }
    return process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || '';
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

    const cleanModel = GeminiService.sanitizeModelName(model, true);

    const body: any = {
      model: cleanModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    } catch (fetchErr: any) {
      const isFailedToFetch = fetchErr.message?.includes('fetch') || fetchErr.name === 'TypeError';
      if (isFailedToFetch) {
        throw new Error(`Gagal terhubung ke endpoint (${cleanBaseUrl}). Terjadi 'Failed to fetch'. Periksa: (1) Pastikan CORS aktif di server LiteLLM (misal CORS_ALLOWED_ORIGINS="*"), (2) Jika web ini di HTTPS, pastikan endpoint LiteLLM menggunakan HTTPS (browser memblokir HTTP/Mixed Content), (3) Pastikan LiteLLM online dan dapat diakses dari browser.`);
      }
      throw fetchErr;
    }

    // Handle Bad Request (e.g. LiteLLM proxy response_format or model group errors)
    if (!response.ok && response.status === 400) {
      const errText = await response.clone().text().catch(() => '');
      console.warn(`[LITELLM_400_WARN] First attempt failed (${cleanModel}): ${errText}`);

      // Try retry 1: without response_format
      delete body.response_format;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      } catch (e) {}

      // Try retry 2: if model group rejected (e.g. no healthy deployments for gemini-3-*), switch to standard model
      if (!response.ok && (errText.includes('no healthy deployments') || errText.includes('Model Group') || errText.includes('model'))) {
        const altModel = 'gpt-4o-mini';
        console.warn(`[LITELLM_RETRY_MODEL] Retrying LiteLLM with fallback model name (${altModel})...`);
        body.model = altModel;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });
        } catch (e) {}
      }
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.error?.message || errData.message || `HTTP ${response.status} (${response.statusText})`;
      throw new Error(`LiteLLM/OpenAI (${body.model}): ${msg}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Response OpenAI/LiteLLM tidak berisi konten hasil (choices[0].message.content kosong).");
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
      throw new Error("Google Gemini API Key belum dikonfigurasi di Pengaturan Situs.");
    }

    const cleanModel = GeminiService.sanitizeModelName(modelId, false);
    const ai = new GoogleGenAI({ apiKey });

    try {
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
    } catch (e: any) {
      if (e.message?.includes('API_KEY_INVALID') || e.message?.includes('API key not valid') || e.message?.includes('400')) {
        throw new Error(`Google Gemini API Key tidak valid. Mohon periksa API Key Google di Pengaturan.`);
      }
      throw e;
    }
  }

  // Connection Test method for Admin Settings Panel
  static async testConnection(settings: AISettings): Promise<{ success: boolean; message: string; latencyMs: number; details?: any }> {
    const start = Date.now();
    try {
      const isExternal = settings.provider === 'external';
      const prompt = "Buat 1 contoh soal sederhana. Format WAJIB JSON: {\"questions\": [{\"text\": \"Berapa 1+1?\", \"options\": [{\"label\": \"A\", \"text\": \"2\"}], \"answer\": \"A\", \"explanation\": \"1+1=2\", \"type\": \"Pilihan Ganda\", \"indicator\": \"Penjumlahan\", \"cognitiveLevel\": \"C1\"}]}";
      const system = "Output WAJIB JSON VALID.";

      let res: any;
      if (isExternal) {
        const baseUrl = settings.baseUrl || process.env.LITELLM_BASE_URL || 'https://api.openai.com/v1';
        const apiKey = settings.customApiKey || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY || '';
        const model = settings.targetModel || 'gpt-4o-mini';
        res = await GeminiService.callOpenAICompatible(baseUrl, apiKey, model, system, prompt);
      } else {
        const apiKey = settings.geminiApiKey || settings.customApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY || '';
        const model = settings.targetModel || 'gemini-2.5-flash';
        res = await GeminiService.callNativeGemini(apiKey, model, system, prompt);
      }

      const latencyMs = Date.now() - start;
      const count = res?.questions?.length || 0;
      return {
        success: true,
        message: `Koneksi Berhasil! Respons (${count} soal) diterima dalam ${latencyMs}ms.`,
        latencyMs,
        details: res
      };
    } catch (e: any) {
      const latencyMs = Date.now() - start;
      return {
        success: false,
        message: e.message || "Gagal terhubung ke AI Engine.",
        latencyMs
      };
    }
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

    const nativeApiKey = GeminiService.getNativeGeminiKey(aiSettings);
    const primaryGeminiModel = GeminiService.sanitizeModelName(params.model || aiSettings.targetModel, false);

    if (isExternalPrimary) {
      // Primary Engine: LiteLLM / OpenAI
      const primaryBaseUrl = aiSettings.baseUrl || process.env.LITELLM_BASE_URL || 'https://api.openai.com/v1';
      const primaryApiKey = GeminiService.getExternalPrimaryKey(aiSettings);
      const model = GeminiService.sanitizeModelName(aiSettings.targetModel || params.model, true);

      try {
        console.log(`[AI_ENGINE] Menggunakan Primary External Engine (${model} @ ${primaryBaseUrl})...`);
        return await GeminiService.callOpenAICompatible(primaryBaseUrl, primaryApiKey, model, system, prompt);
      } catch (primaryErr: any) {
        console.warn(`[AI_ENGINE_WARNING] Primary External Engine Error: ${primaryErr.message}`);

        // Try Fallback to Native Gemini only if a valid key is provided
        if (nativeApiKey) {
          try {
            console.log(`[AI_ENGINE] Mencoba Fallback ke Native Gemini Engine (${primaryGeminiModel})...`);
            return await GeminiService.callNativeGemini(nativeApiKey, primaryGeminiModel, system, prompt);
          } catch (fallbackErr: any) {
            throw new Error(`External Engine Gagal: ${primaryErr.message}. Fallback Gemini Native juga Gagal: ${fallbackErr.message}`);
          }
        } else {
          throw new Error(`External Engine Gagal: ${primaryErr.message}`);
        }
      }
    } else {
      // Primary Engine: Native Gemini
      try {
        console.log(`[AI_ENGINE] Menggunakan Primary Native Gemini Engine (${primaryGeminiModel})...`);
        return await GeminiService.callNativeGemini(nativeApiKey, primaryGeminiModel, system, prompt);
      } catch (primaryErr: any) {
        console.warn(`[AI_ENGINE_WARNING] Primary Gemini Error: ${primaryErr.message}`);

        // Try Fallback to OpenAI / LiteLLM
        const fallbackBaseUrl = aiSettings.fallbackBaseUrl || aiSettings.baseUrl || process.env.LITELLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        const fallbackApiKey = GeminiService.getExternalFallbackKey(aiSettings);
        const fallbackModel = GeminiService.sanitizeModelName(aiSettings.fallbackModel || 'gpt-4o-mini', true);
        const isFallbackEnabled = aiSettings.enableFallback !== false;

        if (isFallbackEnabled && (fallbackApiKey || process.env.OPENAI_API_KEY || process.env.LITELLM_API_KEY)) {
          try {
            console.log(`[AI_ENGINE] Mencoba Fallback ke OpenAI/LiteLLM Engine (${fallbackModel} @ ${fallbackBaseUrl})...`);
            return await GeminiService.callOpenAICompatible(fallbackBaseUrl, fallbackApiKey, fallbackModel, system, prompt);
          } catch (fallbackErr: any) {
            throw new Error(`Gemini Primary Gagal: ${primaryErr.message}. Fallback OpenAI/LiteLLM Gagal: ${fallbackErr.message}`);
          }
        } else {
          throw new Error(`Gemini Engine Gagal: ${primaryErr.message}. ${isFallbackEnabled ? '(Tips: Masukkan Fallback API Key OpenAI/LiteLLM di Pengaturan Situs agar otomatis beralih)' : ''}`);
        }
      }
    }
  }

  async generateVisual(prompt: string): Promise<string> {
    const aiSettings = await StorageService.getAISettings();
    const apiKey = GeminiService.getNativeGeminiKey(aiSettings);
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

