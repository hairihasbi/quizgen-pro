
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * DOKU Checkout API Handler - Signature Fix v2
 * Mengatasi 'Invalid Header Signature' dengan format strict.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil Pengaturan
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'DOKU Client ID atau Secret Key belum dikonfigurasi.' });
    }

    // 2. Persiapkan Variabel Identitas (Satu Sumber Kebenaran)
    const invoiceId = `INV${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const requestId = crypto.randomUUID();
    // DOKU sangat sensitif terhadap format ISO. Pastikan tanpa milidetik jika memungkinkan.
    const timestamp = new Date().toISOString().slice(0, 19) + 'Z'; 
    const targetPath = '/checkout/v1/payment';

    // 3. Persiapkan Payload Body
    const payload = {
      order: {
        amount: Math.floor(Number(packageInfo.amount)),
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: "https://genquiz.my.id/history",
        line_items: [{
          id: `PKG-${packageInfo.credits}`,
          name: (packageInfo.name || 'Topup Kredit').substring(0, 50),
          price: Math.floor(Number(packageInfo.amount)),
          quantity: 1
        }]
      },
      customer: {
        name: (user.fullName || user.username || 'Teacher').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 32),
        email: (user.email || `${user.username}@quizgen.pro`).trim()
      }
    };

    // 4. Kalkulasi Digest (SHA256 dari Body, lalu Base64)
    const bodyString = JSON.stringify(payload);
    const digest = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Konstruksi String-To-Sign (STRICT FORMAT - NO SPACES AFTER COLONS)
    // Format: Client-Id:{ID}\nRequest-Id:{RID}\nRequest-Timestamp:{TS}\nRequest-Target:{TARGET}\nDigest:{DIGEST}
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digest}`;

    // 6. Generate Signature HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // Simpan Transaksi ke DB sebelum hit API
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    const isProd = dbSettings.mode === 'production' || process.env.NODE_ENV === 'production';
    const dokuBaseUrl = isProd ? 'https://api.doku.com' : 'https://api-sandbox.doku.com';

    // 7. Kirim Request dengan Header yang Sesuai
    const response = await fetch(`${dokuBaseUrl}${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': digest,
        'Content-Type': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();

    if (response.ok && data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      // Log kegagalan untuk debugging via Vercel Logs
      console.error("[DOKU_ERROR_LOG]", {
        status: response.status,
        message: data.error?.message,
        requestId,
        timestamp,
        stringToSign: stringToSign.replace(/\n/g, ' [NL] ') // Ganti newline agar mudah dibaca di log
      });
      return res.status(response.status).json({
        message: data.error?.message || "DOKU API Error: Invalid Signature atau Konfigurasi",
        details: data
      });
    }
  } catch (error: any) {
    console.error("[CRITICAL_CHECKOUT_ERROR]", error);
    return res.status(500).json({ message: `Internal Error: ${error.message}` });
  }
}
