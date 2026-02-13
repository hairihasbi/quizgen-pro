
// @google/genai senior frontend engineer fixes
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";

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
    return "Terjadi kendala misterius saat memproses data. Coba lagi dalam beberapa saat.";
  }

  private static getSystemInstruction(subject: string, allowedTypes: string[], literacyMode: string): string {
    const s = subject.toLowerCase();
    const isEksakta = s.includes('matematika') || s.includes('fisika') || s.includes('kimia') || s.includes('sains');
    
    let instruction = `Anda adalah AI Senior pembuat soal Kurikulum Merdeka Indonesia yang super presisi.
    
    ATURAN KETAT TIPE SOAL:
    1. Anda HANYA boleh membuat soal dengan tipe berikut: ${allowedTypes.join(', ')}.
    2. JANGAN PERNAH membuat tipe soal 'Pilihan Ganda' kecuali jika tipe tersebut ada dalam daftar di atas.
    3. Jika tipe 'Benar/Salah' diminta: Field 'options' WAJIB berisi tepat 2 item: [{label: 'A', text: 'Benar'}, {label: 'B', text: 'Salah'}].
    4. Jika tipe 'Isian Singkat' atau 'Uraian/Essay' diminta: Field 'options' harus KOSONG atau NULL.
    5. Setiap soal WAJIB memiliki field 'type' yang nilainya sama persis dengan string tipe soal yang diminta.`;

    if (literacyMode === 'Literasi Grup (AKM)' || literacyMode === 'Literasi Individual') {
      instruction += `\n\nROLE TAMBAHAN: Senior Item Writer Spesialis AKM.
      - WAJIB buat 'passage' (wacana) 200-350 kata.
      - Soal harus bersifat Context-Dependent (harus baca wacana).`;
    }

    if (isEksakta) {
      instruction += "\nSTATUS: EXPERT STEM. WAJIB gunakan LaTeX format $ ... $ untuk simbol dan rumus.";
    }

    instruction += `\n\nKONTROL KUALITAS:
    - Berikan pembahasan (explanation) yang mendalam.
    - Output HARUS JSON VALID sesuai schema.`;
    
    return instruction;
  }

  private async executeTask<T>(
    task: (ai: GoogleGenAI) => Promise<T>
  ): Promise<T> {
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
    
    // Kalkulasi distribusi agar AI tidak bingung jumlah per tipe
    const typeDistribution = allowedTypes.map((type: string, idx: number) => {
      const baseShare = Math.floor(totalCount / allowedTypes.length);
      const extra = idx < (totalCount % allowedTypes.length) ? 1 : 0;
      return `${type}: ${baseShare + extra} soal`;
    }).join(', ');

    const system = GeminiService.getSystemInstruction(params.subject, allowedTypes, params.literacyMode);
    const selectedModel = params.model || 'gemini-3-pro-preview';
    
    const prompt = `TUGAS: BUATKAN ${totalCount} SOAL UNTUK ${params.subject.toUpperCase()} TENTANG ${params.topic}.
    JENJANG: ${params.level} ${params.grade}. KESULITAN: ${params.difficulty}.
    BAHASA PENGANTAR: ${params.language}.
    
    DISTRIBUSI TIPE SOAL WAJIB (TOTAL ${totalCount}):
    ${typeDistribution}
    
    KETENTUAN KHUSUS:
    - Pilihan Ganda & Kompleks: Gunakan ${params.optionCount} opsi.
    - Benar/Salah: Opsi HANYA 'Benar' dan 'Salah'.
    - Isian & Essay: Tanpa opsi.
    - Mode Literasi: ${params.literacyMode}. 
    ${params.literacyMode === 'Literasi Grup (AKM)' ? `Gunakan 1 wacana (stimulus) untuk setiap ${params.questionsPerPassage} soal.` : ''}
    
    HARAP DIPERHATIKAN: Jangan membuat soal tipe lain selain yang disebutkan dalam distribusi di atas. Seluruh teks soal, opsi, dan penjelasan HARUS dalam ${params.language}.`;

    return this.executeTask(async (ai) => {
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
                    passage: { type: Type.STRING },
                    passageHeader: { type: Type.STRING },
                    passageGroupId: { type: Type.STRING },
                    answer: { type: Type.STRING }, 
                    explanation: { type: Type.STRING }, 
                    type: { 
                      type: Type.STRING, 
                      description: `Wajib salah satu dari: ${allowedTypes.join(', ')}` 
                    },
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
    return this.executeTask(async (ai) => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: `Professional educational diagram: ${prompt}` }] }
        });
        const part = response?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        return part?.inlineData ? `data:image/png;base64,${part.inlineData.data}` : "";
      } catch (e) { return ""; }
    });
  }
}
