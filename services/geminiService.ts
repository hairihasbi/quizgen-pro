import { GoogleGenAI } from "@google/genai";
import { StorageService } from "./storageService";
import { AISettings } from "../types";

export class GeminiService {
  public static extractJson(text: string): any {
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
  public static sanitizeModelName(modelName: string): string {
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

  // Method for calling OpenAI / LiteLLM compatible API
  public static async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<any> {
    let cleanBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    let endpoint = cleanBaseUrl;

    // Check if user provided Google Generative Language endpoint
    if (cleanBaseUrl.includes("generativelanguage.googleapis.com")) {
      if (!cleanBaseUrl.includes("/chat/completions")) {
        if (!cleanBaseUrl.includes("/openai")) {
          if (!cleanBaseUrl.includes("/v1beta")) {
            endpoint = `${cleanBaseUrl}/v1beta/openai/chat/completions`;
          } else {
            endpoint = `${cleanBaseUrl}/openai/chat/completions`;
          }
        } else {
          endpoint = `${cleanBaseUrl}/chat/completions`;
        }
      }
    } else {
      if (!cleanBaseUrl.endsWith("/chat/completions")) {
        if (cleanBaseUrl.endsWith("/v1") || cleanBaseUrl.endsWith("/v1beta") || cleanBaseUrl.endsWith("/openai")) {
          endpoint = `${cleanBaseUrl}/chat/completions`;
        } else {
          // If no /v1 was given, check if it's a bare domain/host
          endpoint = `${cleanBaseUrl}/chat/completions`;
        }
      }
    }

    const cleanKey = (apiKey || "").trim();

    // If using googleapis endpoint, also add query param for safety
    if (endpoint.includes("generativelanguage.googleapis.com") && cleanKey && !endpoint.includes("key=")) {
      endpoint += (endpoint.includes("?") ? "&" : "?") + `key=${encodeURIComponent(cleanKey)}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (cleanKey) {
      headers["Authorization"] = `Bearer ${cleanKey}`;
      headers["api-key"] = cleanKey;
      headers["x-api-key"] = cleanKey;
      headers["x-goog-api-key"] = cleanKey;
    }

    const makeRequest = async (withJsonFormat: boolean) => {
      const payload: any = {
        model: model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7
      };

      if (withJsonFormat) {
        payload.response_format = { type: "json_object" };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      return res;
    };

    let res: Response;
    try {
      res = await makeRequest(true);
    } catch (fetchErr: any) {
      // If direct endpoint failed and URL didn't have /v1, try fallback with /v1/chat/completions
      if (!cleanBaseUrl.includes("/v1") && !cleanBaseUrl.endsWith("/chat/completions")) {
        try {
          endpoint = `${cleanBaseUrl}/v1/chat/completions`;
          res = await makeRequest(true);
        } catch (e) {
          throw new Error(`Tidak dapat terhubung ke ${cleanBaseUrl}: ${fetchErr.message}. Pastikan URL dapat diakses dan CORS diizinkan.`);
        }
      } else {
        throw new Error(`Gagal menghubungi LiteLLM/LLM Endpoint (${endpoint}): ${fetchErr.message}`);
      }
    }

    // If 400 Bad Request happens (some providers do not support response_format: { type: "json_object" })
    if (res.status === 400) {
      const errBodyText = await res.text().catch(() => "");
      // Try again without response_format if it might be an unaccepted parameter
      if (errBodyText.toLowerCase().includes("response_format") || errBodyText.toLowerCase().includes("additional properties") || errBodyText.toLowerCase().includes("unrecognized")) {
        console.warn("[LITELLM_RETRY] Retrying request without response_format param...");
        res = await makeRequest(false);
      } else {
        // Parse friendly error message
        let detailedMsg = errBodyText;
        try {
          const parsedErr = JSON.parse(errBodyText);
          detailedMsg = parsedErr.error?.message || parsedErr.message || errBodyText;
        } catch (e) {}

        if (detailedMsg.toLowerCase().includes("api key not valid") || detailedMsg.toLowerCase().includes("invalid_argument")) {
          throw new Error(`LiteLLM / API Gateway Error 400: API Key tidak valid. Silakan periksa kembali API Key / Bearer Token di menu 'API Keys'. Detail: ${detailedMsg}`);
        }
        throw new Error(`LiteLLM / API Gateway Error 400: ${detailedMsg}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let detailedMsg = errText;
      try {
        const parsedErr = JSON.parse(errText);
        detailedMsg = parsedErr.error?.message || parsedErr.message || errText;
      } catch (e) {}
      throw new Error(`LiteLLM / API Gateway Error (HTTP ${res.status}): ${detailedMsg || res.statusText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Respon dari LiteLLM/OpenAI kosong atau tidak memiliki format message content.");
    }

    return GeminiService.extractJson(content);
  }

  // Method for calling Native Gemini SDK with a single key
  public static async executeGeminiCall(
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

  // Standalone connection test helper for admin UI
  public static async testConnection(
    settings: AISettings,
    target: 'primary' | 'fallback' | 'gemini-cluster'
  ): Promise<{ success: boolean; latencyMs: number; message: string; details?: any }> {
    const startTime = Date.now();
    const testSystem = "Anda adalah AI asisten penguji. Jawab hanya dalam format JSON valid: {\"status\":\"ok\",\"engine\":\"active\"}";
    const testPrompt = "Test ping validasi format JSON";

    try {
      if (target === 'primary') {
        if (!settings.baseUrl || !settings.baseUrl.trim()) {
          throw new Error("Base URL LiteLLM / Gateway belum diisi.");
        }
        const res = await GeminiService.callOpenAICompatible(
          settings.baseUrl,
          settings.customApiKey,
          settings.targetModel || "gpt-4o-mini",
          testSystem,
          testPrompt
        );
        const latency = Date.now() - startTime;
        return { 
          success: true, 
          latencyMs: latency, 
          message: `Koneksi LiteLLM / LLM Gateway Berhasil (${latency}ms)! Model: ${settings.targetModel || 'default'}`, 
          details: res 
        };
      }

      if (target === 'fallback') {
        if (!settings.fallbackBaseUrl || !settings.fallbackBaseUrl.trim()) {
          throw new Error("Fallback Base URL belum diisi.");
        }
        const res = await GeminiService.callOpenAICompatible(
          settings.fallbackBaseUrl,
          settings.fallbackApiKey || "",
          settings.fallbackModel || "gpt-4o-mini",
          testSystem,
          testPrompt
        );
        const latency = Date.now() - startTime;
        return { success: true, latencyMs: latency, message: `Koneksi Fallback Gateway Berhasil (${latency}ms)! Model: ${settings.fallbackModel}`, details: res };
      }

      // Test Gemini Cluster Pool
      const allKeys = await StorageService.getApiKeys();
      const activeKeys = allKeys.filter(k => k.isActive && k.key && k.key.trim().length > 5);
      const testKey = activeKeys[0]?.key || settings.geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;

      if (!testKey) {
        throw new Error("Tidak ditemukan API Key Gemini aktif dalam pool maupun environment.");
      }

      const res = await GeminiService.executeGeminiCall(testKey, "gemini-2.5-flash", testSystem, testPrompt);
      const latency = Date.now() - startTime;
      return { success: true, latencyMs: latency, message: `Koneksi Gemini Native Sukses (${latency}ms)! Node: ${testKey.substring(0, 8)}...`, details: res };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      let errMsg = err.message || "Unknown error";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg += " (Kendala CORS pada Server LiteLLM atau Mixed Content HTTP/HTTPS. Pastikan LiteLLM mengizinkan header CORS: CORS_ALLOWED_ORIGINS='*').";
      }
      return { success: false, latencyMs: latency, message: `Uji Koneksi Gagal: ${errMsg}` };
    }
  }

  async generateQuiz(params: any): Promise<any> {
    const aiSettings = await StorageService.getAISettings();
    const system = GeminiService.getSystemInstruction(params);
    const prompt = `TUGAS: BUATKAN ${params.count} SOAL ${params.subject} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}.
    TIPE SOAL: ${params.questionTypes.join(', ')}.
    TINGKAT KESULITAN: ${params.difficulty}.
    VARIAN LEVEL: ${params.cognitiveLevels.join(', ')}.`;

    const modelId = params.model || 'gemini-2.5-flash';
    let externalError: any = null;

    // 1. If provider is external (LiteLLM / OpenAI Gateway) OR baseUrl is configured
    const shouldUseExternal = aiSettings.provider === 'external' || (Boolean(aiSettings.baseUrl && aiSettings.baseUrl.trim().length > 3));

    if (shouldUseExternal && aiSettings.baseUrl) {
      try {
        console.log(`[AI_GATEWAY] Memanggil External LiteLLM (${aiSettings.baseUrl}) dengan model ${aiSettings.targetModel || 'default'}...`);
        const result = await GeminiService.callOpenAICompatible(
          aiSettings.baseUrl,
          aiSettings.customApiKey,
          aiSettings.targetModel || 'gpt-4o-mini',
          system,
          prompt
        );
        return result;
      } catch (externalErr: any) {
        console.warn(`[AI_GATEWAY_WARN] External LiteLLM gagal: ${externalErr.message}`);
        externalError = externalErr;
        
        // If user explicitly configured 'external' as primary and fallback is disabled, don't silently switch to Gemini Cluster
        if (aiSettings.provider === 'external' && !aiSettings.enableFallback) {
          throw new Error(`Gagal memproses dengan LiteLLM / LLM Gateway: ${externalErr.message}`);
        }
      }
    }

    // 2. Try Gemini Cluster Pool (Rotating API Management)
    const allKeys = await StorageService.getApiKeys();
    const activeKeys = allKeys.filter(k => k.isActive && k.key && k.key.trim().length > 5);
    const sortedKeys = [...activeKeys].sort((a, b) => (a.errorCount - b.errorCount) || (a.usageCount - b.usageCount));

    let lastClusterError: any = null;

    if (sortedKeys.length > 0) {
      for (const keyItem of sortedKeys) {
        try {
          console.log(`[AI_CLUSTER] Memanggil node API Key Gemini (${keyItem.key.substring(0, 8)}...)...`);
          const result = await GeminiService.executeGeminiCall(keyItem.key, modelId, system, prompt);
          await StorageService.incrementApiKeyUsage(keyItem.key);
          return result;
        } catch (err: any) {
          console.warn(`[AI_CLUSTER_WARN] Node (${keyItem.key.substring(0, 8)}...) gagal: ${err.message}`);
          await StorageService.reportApiKeyError(keyItem.id);
          lastClusterError = err;
        }
      }
    }

    // 3. Try Environment API Key
    const envKey = process.env.API_KEY || process.env.GEMINI_API_KEY || aiSettings.geminiApiKey;
    if (envKey && envKey.trim().length > 5) {
      try {
        console.log(`[AI_CLUSTER] Mencoba backup environment API Key...`);
        return await GeminiService.executeGeminiCall(envKey, modelId, system, prompt);
      } catch (err: any) {
        lastClusterError = err;
      }
    }

    // 4. Try Fallback LiteLLM/OpenAI Gateway if configured
    if (aiSettings.enableFallback && aiSettings.fallbackBaseUrl && aiSettings.fallbackBaseUrl.trim().length > 3) {
      try {
        console.log(`[AI_FALLBACK] Mencoba Fallback LiteLLM Gateway (${aiSettings.fallbackBaseUrl})...`);
        return await GeminiService.callOpenAICompatible(
          aiSettings.fallbackBaseUrl,
          aiSettings.fallbackApiKey || "",
          aiSettings.fallbackModel || "gpt-4o-mini",
          system,
          prompt
        );
      } catch (fallbackErr: any) {
        console.error(`[AI_FALLBACK_ERR] Fallback gateway juga gagal: ${fallbackErr.message}`);
      }
    }

    // If external error occurred, prioritize showing the external error message
    if (externalError) {
      throw new Error(`Gagal menggunakan LLM / LiteLLM Gateway: ${externalError.message}${lastClusterError ? ` (Cluster Gemini juga gagal: ${lastClusterError.message})` : ''}`);
    }

    if (sortedKeys.length === 0 && !envKey && (!aiSettings.baseUrl || !aiSettings.baseUrl.trim())) {
      throw new Error("Belum ada API Key Gemini atau Konfigurasi LiteLLM yang aktif. Silakan buka menu 'API Keys' pada sidebar admin untuk mengaturnya.");
    }

    throw new Error(lastClusterError?.message || "Seluruh mesin AI (LiteLLM & Gemini Cluster) mengalami kegagalan. Silakan periksa pengaturan pada menu 'API Keys'.");
  }

  async generateVisual(prompt: string): Promise<string> {
    const allKeys = await StorageService.getApiKeys();
    const activeKeys = allKeys.filter(k => k.isActive && k.key && k.key.trim().length > 5);
    const aiSettings = await StorageService.getAISettings();
    const apiKey = activeKeys[0]?.key || aiSettings.geminiApiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    
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
