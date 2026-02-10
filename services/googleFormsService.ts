
import { Quiz, QuestionType } from "../types";

export class GoogleFormsService {
  private static SCOPES = "https://www.googleapis.com/auth/forms.body";

  private static async getDynamicClientId(): Promise<string> {
    try {
      const res = await fetch('/api/google-settings');
      if (!res.ok) throw new Error("Gagal mengambil konfigurasi Google.");
      const data = await res.json();
      return data.clientId;
    } catch (e) {
      console.error("Client ID Fetch Error:", e);
      throw new Error("Google Client ID belum diatur oleh Admin.");
    }
  }

  private static async getAccessToken(): Promise<string> {
    const clientId = await this.getDynamicClientId();
    
    return new Promise((resolve, reject) => {
      if (!(window as any).google?.accounts?.oauth2) {
        reject(new Error("Google Identity Services tidak dimuat."));
        return;
      }

      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || "Izin ditolak."));
          } else {
            resolve(response.access_token);
          }
        },
      });

      client.requestAccessToken();
    });
  }

  public static async exportToForms(quiz: Quiz): Promise<string> {
    try {
      const token = await this.getAccessToken();

      const createResponse = await fetch("https://forms.googleapis.com/v1/forms", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          info: {
            title: quiz.title,
            documentTitle: `GenZ-QuizGen: ${quiz.title}`,
          },
        }),
      });

      if (!createResponse.ok) throw new Error("Gagal membuat formulir.");
      const form = await createResponse.json();
      const formId = form.formId;

      const requests = quiz.questions.map((q, index) => {
        const cleanTitle = q.text.replace(/<[^>]*>?/gm, '').replace(/\$|\\/g, '');
        const item: any = {
          title: cleanTitle,
          questionItem: { question: { required: true } }
        };

        if (q.options && q.options.length > 0) {
          item.questionItem.question.choiceQuestion = {
            type: q.type === QuestionType.COMPLEX_MCQ ? "CHECKBOX" : "RADIO",
            options: q.options.map(opt => ({ 
              value: opt.text.replace(/<[^>]*>?/gm, '').replace(/\$|\\/g, '') 
            })),
          };
        } else {
          item.questionItem.question.textQuestion = { paragraph: q.type === QuestionType.ESSAY };
        }

        return { createItem: { item, location: { index } } };
      });

      const updateResponse = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests, includeFormInResponse: true }),
      });

      if (!updateResponse.ok) throw new Error("Gagal mengisi soal.");
      return `https://docs.google.com/forms/d/${formId}/edit`;
    } catch (error: any) {
      throw error;
    }
  }
}
