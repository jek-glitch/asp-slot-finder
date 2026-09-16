// One-off diagnostic endpoint: runs the same form-filling flow as check.js
// for a single profile, but screenshots every major step instead of scanning
// for real. Open the returned images to see exactly what Puppeteer sees on
// Vercel (which can differ from what you see in your own browser).
//
// Usage: GET /api/debug-check?id=PROFILE_ID&secret=YOUR_CRON_SECRET
// Delete this file once the form-filling works — it's for troubleshooting only.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { redis } from './_redis.js';
import { fillApplicationForm } from './_formFiller.js';

export default async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { id } = req.query;
  const profiles = (await redis.get('profiles')) || [];
  const profile = profiles.find((p) => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: 'profile not found', knownIds: profiles.map((p) => p.id) });
  }

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const shots = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1800 });

    const shot = async (label) => {
      const buf = await page.screenshot({ encoding: 'base64', fullPage: true });
      shots.push({ label, image: `data:image/png;base64,${buf}` });
    };

    await page.goto(profile.url, { waitUntil: 'networkidle2', timeout: 35000 });
    await shot('0-initial-load');

    await fillApplicationForm(page, profile, { onStep: shot });

    await page.waitForSelector('.fod-picker-calendar', { timeout: 15000 }).catch(() => {});
    await shot('final-calendar-check');

    res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Debug: ${profile.name}</title>
      <style>body{font-family:sans-serif;background:#111;color:#eee;padding:16px}
      .step{margin-bottom:24px} img{max-width:100%;border:1px solid #444}</style>
      </head><body>
      <h2>Отладка профиля: ${profile.name}</h2>
      ${shots.map((s) => `<div class="step"><h3>${s.label}</h3><img src="${s.image}"/></div>`).join('')}
      </body></html>`);
  } catch (e) {
    res.status(500).json({ error: e.message, shots });
  } finally {
    await browser.close();
  }
}
