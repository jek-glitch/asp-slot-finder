import { redis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const profiles = (await redis.get('profiles')) || [];
    const enriched = await Promise.all(
      profiles.map(async (p) => ({
        ...p,
        bestLabel: await redis.get(`bestLabel:${p.id}`),
        bestIso: await redis.get(`best:${p.id}`),
      }))
    );
    return res.status(200).json({ profiles: enriched });
  }

  if (req.method === 'POST') {
    const { name, url } = req.body || {};
    if (!url || !/^https:\/\/eservicii\.gov\.md\//.test(url)) {
      return res.status(400).json({ error: 'invalid url' });
    }
    const profiles = (await redis.get('profiles')) || [];
    const profile = { id: `p_${Date.now()}`, name: name || url, url };
    profiles.push(profile);
    await redis.set('profiles', profiles);
    return res.status(200).json({ profile });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {};
    const profiles = (await redis.get('profiles')) || [];
    await redis.set('profiles', profiles.filter((p) => p.id !== id));
    await redis.del(`best:${id}`, `bestLabel:${id}`, `history:${id}`, `subs:${id}`);
    return res.status(200).json({ deleted: true });
  }

  res.status(405).json({ error: 'method not allowed' });
}
