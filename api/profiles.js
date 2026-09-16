import { redis } from './_redis.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const profiles = (await redis.get('profiles')) || [];
    // Only expose non-sensitive fields to the browser — check.js reads the
    // full records straight from redis, it doesn't need this endpoint.
    const enriched = await Promise.all(
      profiles.map(async (p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        bestLabel: await redis.get(`bestLabel:${p.id}`),
        bestIso: await redis.get(`best:${p.id}`),
      }))
    );
    return res.status(200).json({ profiles: enriched });
  }

  if (req.method === 'POST') {
    const {
      name, url,
      idnp, lastName, firstName, phone, email,
      idDocument, idDocumentDate, medicalCert,
      service, category, reason, location,
    } = req.body || {};

    if (!url || !/^https:\/\/eservicii\.gov\.md\//.test(url)) {
      return res.status(400).json({ error: 'invalid url' });
    }

    const profiles = (await redis.get('profiles')) || [];
    const profile = {
      id: `p_${Date.now()}`,
      name: name || url,
      url,
      idnp: idnp || '',
      lastName: lastName || '',
      firstName: firstName || '',
      phone: phone || '',
      email: email || '',
      idDocument: idDocument || '',
      idDocumentDate: idDocumentDate || '',
      medicalCert: medicalCert || '',
      service: service || '',
      category: category || '',
      reason: reason || '',
      location: location || '',
    };
    profiles.push(profile);
    await redis.set('profiles', profiles);
    return res.status(200).json({ profile: { id: profile.id, name: profile.name, url: profile.url } });
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
