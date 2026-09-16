import { redis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { profileId } = req.query;
  if (!profileId) return res.status(400).json({ error: 'profileId required' });
  const raw = (await redis.lrange(`history:${profileId}`, 0, 19)) || [];
  const entries = raw.map((r) => (typeof r === 'string' ? JSON.parse(r) : r));
  res.status(200).json({ entries });
}
