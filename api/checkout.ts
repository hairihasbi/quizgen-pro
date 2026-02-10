
import { createClient } from '@libsql/client';
import crypto from 'crypto';

/**
 * Handler Checkout DOKU v1 - High Precision Signature
 * Memperbaiki masalah 'Invalid Header Signature' dengan standarisasi format.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  if (!TURSO_URL) return res.status(500).json({ message: 'Database configuration error' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  const { user, packageInfo } = req.body;

  try {
    // 1. Ambil & Bersihkan Konfigurasi
    const resPayment = await db.execute("SELECT data FROM payment_settings WHERE id = 'global'");
    let dbSettings = resPayment.rows.length > 0 ? JSON.parse(resPayment.rows[0].data as string) : {};

    // Pastikan kunci dibersihkan dari spasi/baris baru yang tidak sengaja terbawa
    const CLIENT_ID = (process.env.DOKU_CLIENT_ID || dbSettings.clientId || "").trim();
    const SECRET_KEY = (process.env.DOKU_SECRET_KEY || dbSettings.secretKey || "").trim();

    if (!CLIENT_ID || !SECRET_KEY) {
      return res.status(500).json({ message: 'DOKU Client ID atau Secret Key tidak ditemukan.' });
    }

    // 2. Identitas Request (Wajib Konsisten)
    const invoiceId = `INV-${Date.now()}-${user.id.substring(0, 4)}`;
    const requestId = crypto.randomUUID();
    // Gunakan format ISO murni tanpa milidetik untuk keamanan kompatibilitas
    const timestamp = new Date().toISOString().split('.')[0] + 'Z';
    const targetPath = '/checkout/v1/payment';
    
    // 3. Persiapkan Payload (Urutan property tidak berpengaruh di hash asalkan bodyString konsisten)
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

    // 4. Kalkulasi Digest (Wajib sama persis dengan body yang di-fetch)
    const bodyString = JSON.stringify(payload);
    const digest = crypto.createHash('sha256').update(bodyString).digest('base64');

    // 5. Kalkulasi Signature (Format String-To-Sign DOKU V1)
    // PENTING: Gunakan titik dua (:) dan baris baru (\n) dengan tepat
    const stringToSign = 
      `Client-Id:${CLIENT_ID}\n` +
      `Request-Id:${requestId}\n` +
      `Request-Timestamp:${timestamp}\n` +
      `Request-Target:${targetPath}\n` +
      `Digest:${digest}`;

    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(stringToSign)
      .digest('base64');

    // Simpan ke DB
    await db.execute({
      sql: "INSERT INTO transactions (id, userId, amount, credits, status, externalId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), user.id, payload.order.amount, packageInfo.credits, 'PENDING', invoiceId, new Date().toISOString()]
    });

    const isProd = dbSettings.mode === 'production' || process.env.NODE_ENV === 'production';
    const dokuBaseUrl = isProd ? 'https://api.doku.com' : 'https://api-sandbox.doku.com';

    // 6. Eksekusi ke DOKU dengan Header yang sinkron
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
      console.error("[DOKU_REJECT]", { 
        status: response.status, 
        requestId, 
        timestamp,
        error: data 
      });
      return res.status(response.status).json({ 
        message: data.error?.message || "DOKU menolak permintaan (Cek Signature/Keys)",
        details: data
      });
    }
  } catch (error: any) {
    console.error("[INTERNAL_CHECKOUT_ERROR]", error);
    return res.status(500).json({ message: `Gagal memproses pembayaran: ${error.message}` });
  }
}
