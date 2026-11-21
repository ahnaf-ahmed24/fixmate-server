import 'dotenv/config';
import { createRequire } from 'node:module';
import { MongoClient } from 'mongodb';

const require = createRequire(import.meta.url);

const API = `http://localhost:${process.env.PORT || 5000}`;
const SITE = 'http://localhost:3000';
const TAG = `mongo-live-${Date.now().toString(36)}`;
const TITLE = `MongoDB Live-Check ${TAG}`;

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  console.log(`  ${cond ? '✓' : '✗ FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  cond ? passed++ : failed++;
}

(async () => {

  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    appName: 'FixMateLiveProof',
  });
  await client.connect();
  const db = client.db(process.env.DB_NAME || 'fixmate');
  const host = (process.env.MONGODB_URI.match(/@([^,/]+)/) || [])[1] || '?';
  console.log(`\n[1] Direct MongoDB connection: host=${host} db=${db.databaseName}`);
  check('MONGODB_URI points at an Atlas cluster', /\.mongodb\.net/.test(host), host);

  const counts = {};
  for (const c of ['users', 'services', 'bookings', 'payments']) {
    counts[c] = await db.collection(c).countDocuments();
  }
  console.log(`  collection counts: ${JSON.stringify(counts)}`);


  const src = await db.collection('services').findOne({ approvalStatus: 'approved', isAvailable: true });
  if (!src) throw new Error('no approved service found to clone');
  const doc = { ...src, title: TITLE, basePrice: 77, createdAt: new Date(), updatedAt: new Date() };
  delete doc._id;
  const ins = await db.collection('services').insertOne(doc);
  console.log(`\n[2] Inserted straight into Atlas (no API involved): "${TITLE}"`);

  try {
    check('document is in Atlas', Boolean(await db.collection('services').findOne({ _id: ins.insertedId })));


    const res = await fetch(`${API}/api/services?search=${encodeURIComponent(TAG)}`);
    const body = await res.json();
    const hits = (body.data || []).map((s) => s.title);
    console.log(`\n[3] GET /api/services?search=${TAG} → ${body.data ? body.data.length : 0} hit(s): ${JSON.stringify(hits)}`);
    check('API returns the direct-Atlas insert', body.success === true && hits.length === 1 && hits[0] === TITLE);

    const [apiPage, atlasPage] = await Promise.all([
      fetch(`${API}/api/services?page=1&limit=9`).then((r) => r.json()),
      db.collection('services')
        .find({ approvalStatus: 'approved', isAvailable: true })
        .sort({ createdAt: -1 })
        .limit(9)
        .toArray(),
    ]);
    const apiTitles = apiPage.data.map((s) => s.title);
    const atlasTitles = atlasPage.map((s) => s.title);
    console.log(`\n[4] API page vs direct Atlas query:`);
    console.log(`  api:   ${JSON.stringify(apiTitles)}`);
    console.log(`  atlas: ${JSON.stringify(atlasTitles)}`);
    check('API output === Atlas data (title-for-title)', JSON.stringify(apiTitles) === JSON.stringify(atlasTitles));


    const { default: puppeteer } = require('D:/Projects/FixMate/client/node_modules/puppeteer-core');
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu'],
    });
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1360, height: 900 });
    await page.goto(`${SITE}/services?search=${TAG}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('main h3', { timeout: 20000 });
    const titles = await page.$$eval('main h3', (els) => els.map((e) => e.textContent.trim()));
    await page.screenshot({ path: 'scripts/mongodb-live-proof.png' });
    await browser.close();
    console.log(`\n[5] Browser loaded /services?search=${TAG}: ${JSON.stringify(titles)}`);
    check('website renders the Atlas-only document', titles.length === 1 && titles[0] === TITLE);


    await db.collection('services').deleteOne({ _id: ins.insertedId });
    const after = await fetch(`${API}/api/services?search=${encodeURIComponent(TAG)}`).then((r) => r.json());
    console.log(`\n[6] Cleanup: deleted from Atlas → API now returns ${(after.data || []).length} hit(s)`);
    check('self-cleaning complete (0 hits)', (after.data || []).length === 0);
  } finally {
    await db.collection('services').deleteMany({ title: TITLE }).catch(() => {});
    await client.close();
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed${failed ? ' → FAILURES REMAIN' : ' → ALL LIVE DATA FROM MONGODB'}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
