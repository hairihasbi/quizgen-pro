
// @google/genai senior frontend engineer fixes
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";
import { StorageService } from "./storageService";

export class GeminiService {
  private async hashText(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static mapErrorToHuman(error: any): string {
    const msg = error.message?.toLowerCase() || "";
    if (msg.includes("429") || msg.includes("quota")) {
      return "Waduh, otak AI kami sedang 'burnout' karena terlalu banyak permintaan. Tunggu 1 menit ya.";
    }
    if (msg.includes("requested entity was not found")) {
      return "Kunci API High-Quality tidak ditemukan atau sudah kadaluarsa. Silakan pilih ulang kunci API Anda.";
    }
    return "Terjadi kendala misterius saat memproses data. Coba lagi dalam beberapa saat.";
  }

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
      const parsed = JSON.parse(cleaned);
      return {
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        grid: parsed.grid || ""
      };
    } catch (e) {
      console.error("[JSON_EXTRACT_ERROR]", e, "Raw Text:", text);
      return { questions: [], tags: [], grid: "" };
    }
  }

  private static getSystemInstruction(subject: string, allowedTypes: string[], literacyMode: string, hasReference: boolean, optionCount: number): string {
    const s = (subject || '').toLowerCase();
    const isEksakta = s.includes('matematika') || s.includes('fisika') || s.includes('kimia') || s.includes('sains');
    let instruction = `Anda adalah AI Senior pembuat soal Kurikulum Merdeka Indonesia yang super presisi.
    OUTPUT WAJIB JSON VALID dengan schema:
    {
      "questions": [
        {
          "text": "Pertanyaan",
          "options": [{"label":"A", "text":"Opsi"}],
          "answer": "Jawaban",
          "explanation": "Pembahasan",
          "type": "Tipe Soal",
          "topic": "Materi",
          "indicator": "Indikator",
          "competency": "CP/KD",
          "cognitiveLevel": "C1/C2/C3...",
          "passage": "Wacana"
        }
      ],
      "tags": ["tag1", "tag2"],
      "grid": "Matriks deskripsi singkat"
    }
    ATURAN KETAT:
    1. Tipe Soal: ${allowedTypes.join(', ')}.
    2. MCQ/Kompleks: Tepat ${optionCount} opsi (A-${String.fromCharCode(64 + optionCount)}).
    3. Benar/Salah: Opsi A: Benar, Opsi B: Salah.
    4. Isian/Essay: Field 'options' harus KOSONG atau NULL.
    5. JANGAN PERNAH meniru daftar soal eksisting yang diberikan.
    ${isEksakta ? "6. Gunakan LaTeX $ ... $ untuk rumus." : ""}`;
    if (hasReference) instruction += `\n7. Setiap soal WAJIB ada 'citation' dari materi referensi.`;
    if (literacyMode !== 'Tanpa Wacana') instruction += `\n8. Buat wacana/stimulus minimal 200 kata di field 'passage'.`;
    return instruction;
  }

  private async executeTask<T>(
    task: (ai: GoogleGenAI) => Promise<T>,
    externalCall?: (settings: any) => Promise<T>
  ): Promise<T> {
    const aiSettings = await StorageService.getAISettings();
    if (aiSettings.provider === 'external' && externalCall) {
      try {
        return await externalCall(aiSettings);
      } catch (e: any) {
        throw new Error("Gagal terhubung ke Engine Eksternal: " + e.message);
      }
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      return await task(ai);
    } catch (e: any) {
      throw new Error(GeminiService.mapErrorToHuman(e));
    }
  }

  async embedText(text: string): Promise<number[]> {
    const textHash = await this.hashText(text);
    const cacheKey = `emb_${textHash}`;
    try {
      const cacheRes = await fetch(`/api/cache?key=${cacheKey}`);
      if (cacheRes.ok) {
        const data = await cacheRes.json();
        if (data.value) return data.value;
      }
    } catch (e) {}
    const values = await this.executeTask(async (ai) => {
      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: { parts: [{ text }] },
      });
      if (!response.embeddings || !response.embeddings[0] || !response.embeddings[0].values) {
        throw new Error("Failed to extract embedding values from response");
      }
      return response.embeddings[0].values;
    });
    try {
      fetch('/api/cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: cacheKey, value: values, ttl: 604800 })
      });
    } catch (e) {}
    return values;
  }

  async generateQuiz(params: any, onBatchProgress?: (current: number, total: number) => void, retrievedContext?: Question[]): Promise<any> {
    const allowedTypes = params.questionTypes;
    const totalCount = params.count;
    const hasReference = !!params.referenceText;
    const optionCount = params.optionCount || 5;
    const system = GeminiService.getSystemInstruction(params.subject, allowedTypes, params.literacyMode, hasReference, optionCount);
    const selectedModel = params.model || 'gemini-3-pro-preview';
    const prompt = `TUGAS: BUATKAN ${totalCount} SOAL UNTUK ${(params.subject || '').toUpperCase()} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}. KESULITAN: ${params.difficulty}.
    ${hasReference ? `REFERENSI: ${params.referenceText}` : ''}
    ${retrievedContext && retrievedContext.length > 0 ? `HINDARI DUPLIKASI TEMA DENGAN SOAL INI: ${retrievedContext.map(q => q.text).join(' | ')}` : ''}`;

    const externalCall = async (settings: any) => {
      const cleanUrl = settings.baseUrl.endsWith('/') ? settings.baseUrl.slice(0, -1) : settings.baseUrl;
      const endpoint = `${cleanUrl}/chat/completions`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.customApiKey}`
        },
        body: JSON.stringify({
          model: settings.targetModel || 'gemini-3-pro-preview',
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Server Eksternal Error (${response.status})`);
      }
      const data = await response.json();
      return GeminiService.extractJson(data.choices[0].message.content);
    };

    return this.executeTask(async (ai) => {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          tools: hasReference ? [] : [{googleSearch: {}}],
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { 
                    text: { type: Type.STRING }, 
                    passage: { type: Type.STRING },
                    answer: { type: Type.STRING }, 
                    explanation: { type: Type.STRING }, 
                    citation: { type: Type.STRING },
                    type: { type: Type.STRING },
                    indicator: { type: Type.STRING },
                    competency: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    cognitiveLevel: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          text: { type: Type.STRING }
                        }
                      }
                    }
                  },
                  required: ["text", "answer", "type", "topic", "explanation"]
                } 
              },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              grid: { type: Type.STRING }
            }
          }
        }
      });
      return GeminiService.extractJson(response.text || "{}");
    }, externalCall);
  }

  /**
   * ADAPTIVE VISUAL GENERATOR
   * 1. Try gemini-2.5-flash-image
   * 2. Fallback to gemini-3-pro-image-preview
   */
  async generateVisual(prompt: string): Promise<string> {
    const aiSettings = await StorageService.getAISettings();

    // Logic for LiteLLM / External
    if (aiSettings.provider === 'external') {
      const cleanUrl = aiSettings.baseUrl.endsWith('/') ? aiSettings.baseUrl.slice(0, -1) : aiSettings.baseUrl;
      const endpoint = `${cleanUrl}/images/generations`;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiSettings.customApiKey}`
          },
          body: JSON.stringify({
            model: aiSettings.targetImageModel || "gemini-2.5-flash-image",
            prompt: `Professional educational diagram or illustration: ${prompt}`,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
          })
        });
        if (response.ok) {
          const data = await response.json();
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }
        return "";
      } catch (e) { return ""; }
    }

    // Logic for Native with Fallback
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // ATTEMPT 1: FLASH (Fast & Cheap)
    try {
      const flashRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Simple educational illustration for: ${prompt}` }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });
      
      const candidate = flashRes.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (e) {
      console.warn("[FLASH_IMAGE_FAILED] Attempting fallback to Pro Engine...");
    }

    // ATTEMPT 2: PRO (High Quality Fallback)
    try {
      const proRes = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: `High quality professional educational diagram or stimulus for: ${prompt}` }] },
        config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
      });
      
      const candidate = proRes.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (e) {
      console.error("[PRO_IMAGE_FAILED] Visual generation completely failed.");
    }

    return "";
  }
}
