
/**
 * Generic Redis Cache API Proxy
 * Menghubungkan Frontend ke Upstash Redis secara aman tanpa mengekspos token.
 */
export default async function handler(req: any, res: any) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(500).json({ message: "Redis configuration missing" });
  }

  const { method, query, body } = req;
  const key = query.key || body.key;

  try {
    if (method === 'GET') {
      if (!key) return res.status(400).json({ message: "Key required" });
      const response = await fetch(`${REDIS_URL}/get/${key}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      const data = await response.json();
      return res.status(200).json({ value: data.result ? JSON.parse(data.result) : null });
    }

    if (method === 'POST') {
      const { value, ttl } = body;
      if (!key || value === undefined) return res.status(400).json({ message: "Key and value required" });
      
      const cmd = ttl ? ['set', key, JSON.stringify(value), 'EX', ttl] : ['set', key, JSON.stringify(value)];
      const response = await fetch(REDIS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
      const data = await response.json();
      return res.status(200).json({ success: data.result === 'OK' });
    }

    return res.status(405).json({ message: "Method Not Allowed" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
