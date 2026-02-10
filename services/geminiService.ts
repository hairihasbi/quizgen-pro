
// @google/genai senior frontend engineer fixes
import { GoogleGenAI, Type } from "@google/genai";
import { StorageService } from "./storageService";
import { ApiKey, QuestionType, Question } from "../types";

export class GeminiService {
  private static async getPrioritizedKeys(): Promise<ApiKey[]> {
    const keys = await StorageService.getApiKeys();
    const activeKeys = keys.filter(k => k.isActive);
    if (activeKeys.length === 0) return [];
    return activeKeys.sort((a, b) => {
      if (a.errorCount !== b.errorCount) return a.errorCount - b.errorCount;
      return a.usageCount - b.usageCount;
    });
  }

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
    return "Terjadi kendala misterius saat memproses data. Coba lagi dalam beberapa saat.";
  }

  private static getSystemInstruction(subject: string, allowedTypes: string[], literacyMode: string): string {
    const s = subject.toLowerCase();
    const isEksakta = s.includes('matematika') || s.includes('fisika') || s.includes('kimia') || s.includes('sains');
    
    // Default Base Instruction
    let instruction = "Anda adalah AI Senior pembuat soal Kurikulum Merdeka Indonesia yang super presisi. ";

    // Penyempurnaan Prompt Khusus Literasi AKM
    if (literacyMode === 'Literasi Grup (AKM)' || literacyMode === 'Literasi Individual') {
      instruction = `ROLE: Anda adalah Senior Item Writer Spesialis AKM (Asesmen Kompetensi Minimum) Nasional.
      
      LOGIKA STIMULUS (WACANA):
      1. WAJIB membuat 'passage' (wacana) yang kaya informasi (fiksi/informatif) sepanjang 200-350 kata.
      2. Wacana harus bersifat "Context-Dependent": Pertanyaan TIDAK BOLEH bisa dijawab tanpa membaca wacana secara utuh.
      3. Jika dalam mode 'Grup', buatlah satu wacana yang kuat untuk menaungi beberapa butir pertanyaan sekaligus.
      
      HIERARKI KOGNITIF (UNTUK MODE GRUP):
      Susun soal secara bertingkat:
      - Soal 1: Level L1 (Retrieve) - Menemukan informasi tersurat.
      - Soal 2: Level L2 (Interpret) - Hubungan antar paragraf atau pesan tersirat.
      - Soal 3+: Level L3 (Reflect/Evaluate) - Menilai akurasi teks atau opini berbasis bukti (HOTS).
      
      KUALITAS PENGECOH:
      Pengecoh harus homogen dan diambil dari fragmen informasi lain di dalam teks agar menguji ketelitian membaca.`;
    }

    if (isEksakta) {
      instruction += "\nSTATUS: EXPERT STEM. WAJIB gunakan LaTeX format $ ... $ untuk simbol dan rumus.";
    }

    instruction += `
    KONTROL KUALITAS OUTPUT:
    1. Tipe Soal yang diizinkan: ${allowedTypes.join(', ')}.
    2. Pilihan Ganda (MCQ) dan Pilihan Ganda Kompleks WAJIB memiliki daftar opsi (choices) sesuai jumlah yang diminta.
    3. Untuk tipe 'Benar/Salah' (Benar/Salah), WAJIB menyertakan array 'options' berisi 2 item: {label: 'A', text: 'Benar'} dan {label: 'B', text: 'Salah'}.
    4. Untuk Pilihan Ganda Kompleks, pastikan kunci jawaban (answer) mencakup semua opsi yang benar.
    5. Format Jawaban: Berikan teks jawaban dan pembahasan yang detail menyertakan bukti tekstual (jika literasi).
    6. Output HARUS JSON VALID sesuai schema.
    `;
    
    return instruction;
  }

  private async executeWithFailover<T>(
    operationName: string,
    task: (ai: GoogleGenAI, key: string) => Promise<T>
  ): Promise<T> {
    const prioritizedKeys = await GeminiService.getPrioritizedKeys();
    if (prioritizedKeys.length === 0) throw new Error("Tidak ada API Key Gemini aktif.");
    
    let lastError: any = null;
    for (let i = 0; i < Math.min(prioritizedKeys.length, 3); i++) {
      const keyObj = prioritizedKeys[i];
      const ai = new GoogleGenAI({ apiKey: keyObj.key });
      try {
        const result = await task(ai, keyObj.key);
        await StorageService.incrementApiKeyUsage(keyObj.key);
        return result;
      } catch (e: any) {
        lastError = e;
        if (e.message?.includes('429')) {
          await StorageService.reportApiKeyError(keyObj.id);
          continue;
        }
        throw new Error(GeminiService.mapErrorToHuman(e));
      }
    }
    throw new Error(GeminiService.mapErrorToHuman(lastError));
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

    const values = await this.executeWithFailover('Embed Text', async (ai) => {
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
    const system = GeminiService.getSystemInstruction(params.subject, allowedTypes, params.literacyMode);
    const selectedModel = params.model || 'gemini-3-pro-preview';
    
    const prompt = `BUATKAN ${params.count} SOAL UNTUK ${params.subject.toUpperCase()} TENTANG ${params.topic}. 
    JENJANG: ${params.level} ${params.grade}. TINGKAT KESULITAN: ${params.difficulty}.
    JUMLAH OPSI UNTUK PILIHAN GANDA & KOMPLEKS: ${params.optionCount}.
    PENTING: Untuk tipe soal 'Benar/Salah', pastikan field 'options' berisi teks 'Benar' dan 'Salah'.
    MODE LITERASI: ${params.literacyMode}. 
    ${params.literacyMode === 'Literasi Grup (AKM)' ? `Gunakan 1 wacana untuk setiap ${params.questionsPerPassage} soal.` : ''}`;

    return this.executeWithFailover('Generate Quiz', async (ai) => {
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: { 
                type: Type.ARRAY, 
                items: { 
                  type: Type.OBJECT, 
                  properties: { 
                    text: { type: Type.STRING }, 
                    passage: { type: Type.STRING, description: "Teks wacana stimulus (hanya diisi pada soal pertama dalam grup atau setiap soal jika individual)" },
                    passageHeader: { type: Type.STRING, description: "Judul wacana" },
                    passageGroupId: { type: Type.STRING, description: "ID unik untuk mengelompokkan soal dalam satu wacana" },
                    answer: { type: Type.STRING }, 
                    explanation: { type: Type.STRING }, 
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
                  } 
                } 
              },
              grid: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });
      return JSON.parse(response.text || "{}");
    });
  }

  async generateVisual(prompt: string): Promise<string> {
    return this.executeWithFailover('Generate Visual', async (ai) => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Professional educational diagram: ${prompt}` }] }
        });
        // FIXED: Optional chaining yang lebih ketat untuk menghindari error TS2532
        const part = response?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
      } catch (e) { return ""; }
    });
  }
}
