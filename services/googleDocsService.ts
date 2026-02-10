
import { Quiz, QuestionType } from "../types";

export class GoogleDocsService {
  private static SCOPES = "https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file";

  private static async getDynamicClientId(): Promise<string> {
    try {
      const res = await fetch('/api/google-settings');
      if (!res.ok) throw new Error("Gagal mengambil konfigurasi Google.");
      const data = await res.json();
      return data.clientId;
    } catch (e) {
      throw new Error("Google Client ID belum diatur oleh Admin.");
    }
  }

  private static async getAccessToken(): Promise<string> {
    const clientId = await this.getDynamicClientId();
    
    return new Promise((resolve, reject) => {
      if (!(window as any).google?.accounts?.oauth2) {
        reject(new Error("Google SDK belum dimuat."));
        return;
      }
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) reject(new Error(response.error_description));
          else resolve(response.access_token);
        },
      });
      client.requestAccessToken();
    });
  }

  public static async exportToDocs(quiz: Quiz): Promise<string> {
    try {
      const token = await this.getAccessToken();

      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Quiz: ${quiz.title}` }),
      });
      if (!createRes.ok) throw new Error("Gagal membuat dokumen.");
      const doc = await createRes.json();
      const documentId = doc.documentId;

      const requests: any[] = [];
      const marginPoints = 15 * 2.83465;
      requests.push({
        updateDocumentStyle: {
          documentStyle: {
            pageSize: { height: { magnitude: 842, unit: 'PT' }, width: { magnitude: 595, unit: 'PT' } },
            marginTop: { magnitude: marginPoints, unit: 'PT' },
            marginBottom: { magnitude: marginPoints, unit: 'PT' },
            marginLeft: { magnitude: marginPoints, unit: 'PT' },
            marginRight: { magnitude: marginPoints, unit: 'PT' },
          },
          fields: "pageSize,marginTop,marginBottom,marginLeft,marginRight"
        }
      });

      const headerText = `${quiz.title.toUpperCase()}\n${quiz.subject} - ${quiz.level} ${quiz.grade}\n\n`;
      requests.push({ insertText: { location: { index: 1 }, text: headerText } });
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: headerText.length + 1 },
          paragraphStyle: { alignment: 'CENTER', spaceAbove: { magnitude: 10, unit: 'PT' }, spaceBelow: { magnitude: 10, unit: 'PT' } },
          fields: "alignment,spaceAbove,spaceBelow"
        }
      });

      let currentIndex = headerText.length + 1;
      for (let i = 0; i < quiz.questions.length; i++) {
        const q = quiz.questions[i];
        const qNum = `${i + 1}. `;
        const cleanText = q.text.replace(/<[^>]*>?/gm, '').replace(/\$|\\/g, '');
        const questionLine = `${qNum}${cleanText}\n`;

        if (q.passage && (i === 0 || quiz.questions[i-1].passage !== q.passage)) {
          const passageText = `[Wacana]\n${q.passage.replace(/<[^>]*>?/gm, '').replace(/\$|\\/g, '')}\n\n`;
          requests.push({ insertText: { location: { index: currentIndex }, text: passageText } });
          currentIndex += passageText.length;
        }

        requests.push({ insertText: { location: { index: currentIndex }, text: questionLine } });
        currentIndex += questionLine.length;

        if (q.options && q.options.length > 0) {
          const rowCount = Math.ceil(q.options.length / 2);
          requests.push({ insertTable: { rows: rowCount, columns: 2, location: { index: currentIndex } } });
          currentIndex += (rowCount * 2 * 2) + 2; 
          requests.push({ insertText: { location: { index: currentIndex }, text: "\n" } });
          currentIndex += 1;
        }
      }

      const updateRes = await fetch(`https://docs.google.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });

      if (!updateRes.ok) throw new Error("Gagal memformat dokumen.");
      return `https://docs.google.com/document/d/${documentId}/edit`;
    } catch (error: any) {
      throw error;
    }
  }
}
