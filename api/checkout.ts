
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * DOKU Checkout API Handler - Production Optimized
 * Endpoint: https://api.doku.com/checkout/v1/payment
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil & Validasi Kredensial
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Kredensial DOKU (Client ID / Secret Key) belum dikonfigurasi di Environment atau Database.' });
    }

    // 2. Persiapan Parameter
    const invoiceId = `INV${Date.now()}`;
    const requestId = crypto.randomUUID();
    // Format DOKU: ISO8601 (YYYY-MM-DDTHH:mm:ssZ)
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';

    // 3. Payload Body (Struktur JSON harus konsisten)
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
        name: String(user.fullName || user.username || 'Customer').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 32),
        email: String(user.email || `${user.username}@quizgen.pro`).trim()
      }
    };

    const bodyString = JSON.stringify(payload);

    // 4. Kalkulasi Digest (Base64 dari SHA256 binary hash)
    const digestHash = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Konstruksi String-To-Sign (Sesuai Spek Jokul V1)
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

    console.log("[DOKU_DEBUG] Sending Request:", { requestId, invoiceId, timestamp });

    // Simpan transaksi PENDING ke DB
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    // 7. Request ke DOKU Production
    const response = await fetch(`https://api.doku.com${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': `SHA-256=${digestHash}`, // Wajib menggunakan prefix SHA-256=
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
        invoiceId,
        error: data
      });
      
      const friendlyError = data.error?.message 
        ? (Array.isArray(data.error.message) ? data.error.message.join(', ') : data.error.message)
        : "DOKU API Error";

      return res.status(response.status).json({
        message: `DOKU Reject: ${friendlyError}. Pastikan Client ID & Secret Key benar-benar dari tab PRODUCTION.`,
        details: data
      });
    }
  } catch (error: any) {
    console.error("[FATAL_CHECKOUT_ERROR]", error);
    return res.status(500).json({ message: `Internal Error: ${error.message}` });
  }
}
