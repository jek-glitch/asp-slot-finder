import { redis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { profileId, subscription, unsubscribe } = req.body || {};
  if (!profileId || !subscription) {
    return res.status(400).json({ error: 'profileId and subscription required' });
  }

  const key = `subs:${profileId}`;
  const subs = (await redis.get(key)) || [];

  if (unsubscribe) {
    await redis.set(key, subs.filter((s) => s.endpoint !== subscription.endpoint));
    return res.status(200).json({ removed: true });
  }

  if (!subs.some((s) => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    await redis.set(key, subs);
  }
  res.status(200).json({ saved: true });
}
