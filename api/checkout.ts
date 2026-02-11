
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * DOKU Checkout API Handler - Production Fixed
 * Dokumen Referensi: https://dashboard.doku.com/docs/docs/jokul-checkout/api-reference/
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil Kredensial
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Kredensial DOKU (Client ID / Secret Key) kosong.' });
    }

    // 2. Persiapan Parameter
    // Pastikan invoice_number unik (max 64 char)
    const invoiceId = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const requestId = crypto.randomUUID();
    
    // Format DOKU Wajib ISO8601: YYYY-MM-DDTHH:mm:ssZ
    // Kita hilangkan milidetik karena DOKU sensitif terhadap hal ini
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';

    // 3. Payload Body (Sesuai Struktur DOKU Checkout V1)
    // DOKU melarang karakter spesial di nama customer
    const cleanCustomerName = String(user.fullName || user.username || 'Guru QuizGen')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .substring(0, 32)
      .trim();

    const payload = {
      order: {
        amount: Math.floor(Number(packageInfo.price || packageInfo.amount)),
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: "https://genquiz.my.id/history",
        line_items: [{
          id: `PKG-${packageInfo.credits}`,
          name: `Topup ${packageInfo.credits} Kredit AI`.substring(0, 50),
          price: Math.floor(Number(packageInfo.price || packageInfo.amount)),
          quantity: 1
        }]
      },
      customer: {
        name: cleanCustomerName,
        email: String(user.email || `${user.username}@quizgen.pro`).trim().toLowerCase()
      }
    };

    const bodyString = JSON.stringify(payload);

    // 4. Kalkulasi Digest (Base64 dari SHA256 binary hash dari BODY)
    const digestHash = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Konstruksi String-To-Sign (URUTAN WAJIB)
    // Tidak boleh ada spasi tambahan setelah titik dua atau di akhir baris
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digestHash}`;

    // 6. Generate Signature HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // Simpan Log ke DB (Pending)
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    // 7. Kirim Request ke DOKU Production
    const response = await fetch(`https://api.doku.com${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': `SHA-256=${digestHash}`, // Prefix SHA-256= Wajib ada di header
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();

    if (response.ok && data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      console.error("[DOKU_REJECTED]", {
        status: response.status,
        requestId,
        invoiceId,
        error: data
      });

      // Berikan detail error asli dari DOKU jika tersedia
      let errorMessage = "Terjadi kesalahan di server DOKU (500).";
      if (data.error?.message) {
         errorMessage = Array.isArray(data.error.message) ? data.error.message.join('. ') : data.error.message;
      }

      return res.status(response.status).json({
        message: `DOKU Response: ${errorMessage}`,
        details: data
      });
    }
  } catch (error: any) {
    console.error("[FATAL_CHECKOUT_ERROR]", error);
    return res.status(500).json({ message: `Internal System Error: ${error.message}` });
  }
}
