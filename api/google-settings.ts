
import { createClient } from '@libsql/client';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const TURSO_URL = process.env.TURSO_DB_URL;
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

  // PRIORITAS: Vercel ENV > Database
  const envClientId = process.env.GOOGLE_CLIENT_ID;

  if (envClientId) {
    return res.status(200).json({ clientId: envClientId, source: 'env' });
  }

  if (!TURSO_URL) return res.status(500).json({ message: 'Database config missing' });
  const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  try {
    const result = await db.execute("SELECT data FROM google_settings WHERE id = 'global'");
    if (result.rows.length > 0) {
      const settings = JSON.parse(result.rows[0].data as string);
      return res.status(200).json({ clientId: settings.clientId, source: 'db' });
    }
    return res.status(404).json({ message: 'Google Client ID not found' });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
