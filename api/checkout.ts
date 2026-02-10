
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * DOKU Checkout API Handler - Production Locked
 * Menangani pembuatan invoice menggunakan Production Gateway DOKU secara permanen.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil & Bersihkan Kredensial
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Konfigurasi DOKU Production (Client ID / Secret Key) tidak ditemukan.' });
    }

    // 2. Persiapan Identitas & Timestamp
    const invoiceId = `INV${Date.now()}`;
    const requestId = crypto.randomUUID();
    // Format DOKU: YYYY-MM-DDTHH:mm:ssZ
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';

    // 3. Payload Body
    const payload = {
      order: {
        amount: Math.floor(Number(packageInfo.amount)),
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: "https://genquiz.my.id/history",
        line_items: [{
          id: `PKG${packageInfo.credits}`,
          name: String(packageInfo.name || 'Topup Kredit').substring(0, 50),
          price: Math.floor(Number(packageInfo.amount)),
          quantity: 1
        }]
      },
      customer: {
        name: String(user.fullName || user.username || 'Teacher').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 32),
        email: String(user.email || `${user.username}@quizgen.pro`).trim()
      }
    };

    const bodyString = JSON.stringify(payload);

    // 4. Kalkulasi Digest (Base64 dari SHA256 body)
    const digestHash = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Konstruksi String-To-Sign (STRICT FORMAT)
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

    // Simpan ke DB sebagai PENDING
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    // SELALU GUNAKAN API PRODUCTION
    const dokuBaseUrl = 'https://api.doku.com';

    // 7. Kirim Request ke DOKU
    const response = await fetch(`${dokuBaseUrl}${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': `SHA-256=${digestHash}`,
        'Content-Type': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();

    if (response.ok && data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      console.error("[DOKU_PRODUCTION_REJECTED]", {
        status: response.status,
        requestId,
        error: data
      });
      return res.status(response.status).json({
        message: data.error?.message || "DOKU API Error: Periksa Kredensial Production Anda",
        details: data
      });
    }
  } catch (error: any) {
    console.error("[FATAL_CHECKOUT_ERROR]", error);
    return res.status(500).json({ message: `Internal Error: ${error.message}` });
  }
}
