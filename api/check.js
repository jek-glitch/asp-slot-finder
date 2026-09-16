import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import webpush from 'web-push';
import { redis } from './_redis.js';
import { fillApplicationForm, findEarliestAvailable } from './_formFiller.js';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || 'admin@example.com'}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function removeSubscription(profileId, endpoint) {
  const subs = (await redis.get(`subs:${profileId}`)) || [];
  await redis.set(
    `subs:${profileId}`,
    subs.filter((s) => s.endpoint !== endpoint)
  );
}

async function notifySubscribers(profile, found) {
  const subs = (await redis.get(`subs:${profile.id}`)) || [];
  const payload = JSON.stringify({
    title: '🎯 Найдена более ранняя дата!',
    body: `${profile.name || profile.url}: ${found.label}`,
    url: profile.url,
  });
  await Promise.all(
    subs.map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          return removeSubscription(profile.id, sub.endpoint);
        }
        console.error('push error', err.statusCode, err.body);
      })
    )
  );
}

export default async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const profiles = (await redis.get('profiles')) || [];
  if (profiles.length === 0) {
    return res.status(200).json({ checked: 0, results: [] });
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const results = [];
  try {
    for (const profile of profiles) {
      const page = await browser.newPage();
      try {
        await page.goto(profile.url, { waitUntil: 'networkidle2', timeout: 35000 });
        await fillApplicationForm(page, profile);
        await page.waitForSelector('.fod-picker-calendar', { timeout: 15000 }).catch(() => {});

        const found = await findEarliestAvailable(page);

        if (found) {
          const bestKey = `best:${profile.id}`;
          const prevBestIso = await redis.get(bestKey);
          const prevBest = prevBestIso ? new Date(prevBestIso) : null;

          if (!prevBest || found.date < prevBest) {
            await redis.set(bestKey, found.date.toISOString());
            await redis.set(`bestLabel:${profile.id}`, found.label);
            await redis.lpush(
              `history:${profile.id}`,
              JSON.stringify({
                label: found.label,
                iso: found.date.toISOString(),
                foundAt: new Date().toISOString(),
              })
            );
            await redis.ltrim(`history:${profile.id}`, 0, 49);
            await notifySubscribers(profile, found);
          }
          results.push({ profileId: profile.id, label: found.label });
        } else {
          results.push({ profileId: profile.id, label: null });
        }
      } catch (e) {
        results.push({ profileId: profile.id, error: e.message });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  res.status(200).json({ checked: results.length, results });
}
