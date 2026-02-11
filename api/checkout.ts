
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * DOKU Checkout API Handler - Production Deep Fix
 * Memastikan Signature & Digest identik dengan ekspektasi Server DOKU.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil & Validasi Kredensial (Trim untuk hindari spasi tak sengaja)
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'Kredensial DOKU (Client ID / Secret Key) tidak ditemukan.' });
    }

    // 2. Persiapan Parameter Wajib
    const invoiceId = `INV${Date.now()}${Math.floor(Math.random() * 100)}`;
    const requestId = crypto.randomUUID();
    
    // Format Wajib: YYYY-MM-DDTHH:mm:ssZ (Tanpa milidetik)
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';

    // 3. Kontruksi Payload (Data harus bersih)
    // DOKU Production sangat sensitif terhadap karakter spesial di nama
    const cleanName = String(user.fullName || user.username || 'Guru GenZ')
      .replace(/[^a-zA-Z0-9 ]/g, '') // Hanya huruf, angka, dan spasi
      .substring(0, 32)
      .trim();

    const payload = {
      order: {
        amount: Math.floor(Number(packageInfo.price || packageInfo.amount)),
        invoice_number: invoiceId,
        currency: "IDR",
        callback_url: "https://genquiz.my.id/history",
        line_items: [{
          id: `PK-${packageInfo.credits}`,
          name: `Topup ${packageInfo.credits} Kredit AI`.substring(0, 50),
          price: Math.floor(Number(packageInfo.price || packageInfo.amount)),
          quantity: 1
        }]
      },
      customer: {
        name: cleanName,
        email: String(user.email || `${user.username}@quizgen.pro`).trim().toLowerCase()
      }
    };

    // PENTING: Stringify sekali saja untuk digunakan di Digest DAN Body Fetch
    // untuk menjamin urutan properti JSON tidak berubah.
    const bodyString = JSON.stringify(payload);

    // 4. Kalkulasi Digest (Base64 dari SHA256 binary hash)
    const digestHash = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Konstruksi String-To-Sign (URUTAN MATI/TIDAK BOLEH BERUBAH)
    // Pola: Client-Id:{ID}\nRequest-Id:{UUID}\nRequest-Timestamp:{ISO}\nRequest-Target:{PATH}\nDigest:{HASH}
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

    // Log Internal (Hanya muncul di Vercel Dashboard Anda, aman)
    console.log("[DOKU_STILL_DEBUGGING]", {
      inv: invoiceId,
      ts: timestamp,
      req: requestId,
      digest: digestHash,
      sign_preview: signature.substring(0, 10) + "..."
    });

    // Simpan status PENDING ke DB
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    // 7. Eksekusi ke Endpoint Production DOKU
    const response = await fetch(`https://api.doku.com${targetPath}`, {
      method: 'POST',
      headers: {
        'Client-Id': CLIENT_ID,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': `HMACSHA256=${signature}`,
        'Digest': `SHA-256=${digestHash}`, // Pastikan ada prefix SHA-256=
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: bodyString
    });

    const data = await response.json();

    if (response.ok && data.response?.payment?.url) {
      return res.status(200).json(data);
    } else {
      console.error("[DOKU_PRODUCTION_REJECTION]", data);

      let detailError = "Periksa konfigurasi Merchant Dashboard (URL White-list/Payment Methods).";
      if (data.error?.message) {
         detailError = Array.isArray(data.error.message) ? data.error.message.join('. ') : data.error.message;
      }

      return res.status(response.status).json({
        message: `DOKU Error: ${detailError}`,
        details: data
      });
    }
  } catch (error: any) {
    console.error("[CHECKOUT_CRITICAL_FAIL]", error);
    return res.status(500).json({ message: `System Error: ${error.message}` });
  }
}
