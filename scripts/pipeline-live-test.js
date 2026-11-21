import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const BASE = process.env.LIVE_TEST_BASE || 'http://localhost:5000';
const ORIGIN = process.env.CLIENT_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${name} ${extra}`);
  }
}

async function call(method, path, { token, cookies, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(cookies ? { Cookie: cookies } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}


async function login(email, password) {
  const res = await call('POST', '/api/auth/sign-in/email', {
    body: { email, password },
  });
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status}`);
  const setCookie = (res.setCookie || '').split(';')[0];
  const tokenRes = await call('GET', '/api/auth/token', { cookies: setCookie });
  const token = tokenRes.json?.token;
  if (!token) throw new Error(`no JWT for ${email}`);
  return { token };
}

async function main() {
  console.log(`[live] target ${BASE}`);


  console.log('\n1) Password policy (server-side)');
  let r = await call('POST', '/api/auth/sign-up/email', {
    body: { name: 'Pw Test', email: 'pwtest-upper@fixmate.com', password: 'abc123', role: 'customer' },
  });
  check('rejects "abc123" (no uppercase) → 400', r.status === 400, `(got ${r.status})`);
  r = await call('POST', '/api/auth/sign-up/email', {
    body: { name: 'Pw Test', email: 'pwtest-lower@fixmate.com', password: 'ABC123', role: 'customer' },
  });
  check('rejects "ABC123" (no lowercase) → 400', r.status === 400, `(got ${r.status})`);
  r = await call('POST', '/api/auth/sign-up/email', {
    body: { name: 'Pw Test', email: 'pwtest-short@fixmate.com', password: 'Ab1', role: 'customer' },
  });
  check('rejects "Ab1" (under 6 chars) → 400', r.status === 400, `(got ${r.status})`);


  console.log('\n2) Role guards (JWT middlewares)');
  const customer = await login('nusrat@fixmate.com', 'Cust@123');
  const tech = await login('rakib@fixmate.com', 'Tech@123');
  const otherTech = await login('sabbir@fixmate.com', 'Tech@123');

  r = await call('GET', '/api/bookings/my');
  check('no token on private route → 401', r.status === 401, `(got ${r.status})`);
  r = await call('GET', '/api/bookings/my', { token: tech.token });
  check('technician on customer route → 403', r.status === 403, `(got ${r.status})`);
  r = await call('POST', '/api/services', { token: customer.token, body: {} });
  check('customer on technician route → 403', r.status === 403, `(got ${r.status})`);
  r = await call('GET', '/api/admin/stats', { token: tech.token });
  check('technician on admin route → 403', r.status === 403, `(got ${r.status})`);

  console.log('\n3) Strict job pipeline (server-enforced)');
  const svcRes = await call('GET', '/api/services?limit=48');
  const raw = svcRes.json || {};
  const list = raw.services || raw.data?.services || raw.data || [];
  const target = list.find(
    (s) => s.approvalStatus === 'approved' && s.technicianEmail === 'rakib@fixmate.com'
  );
  if (!target) throw new Error('no approved service by rakib found');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const bookingBody = {
    serviceId: target._id || target.id,
    customerPhone: '+8801933445566',
    address: 'House 12, Road 5, Uttara, Dhaka',
    preferredDate: tomorrow,
    problemDescription: 'Cooling is weak and the unit leaks water near the vent.',
  };

  r = await call('POST', '/api/bookings', { token: customer.token, body: bookingBody });
  check('customer creates booking → 201', r.status === 201 || r.status === 200, `(got ${r.status})`);
  const bookingId = r.json?.data?._id || r.json?.data?.id || r.json?._id;
  if (!bookingId) throw new Error('booking id missing from response: ' + JSON.stringify(r.json));
  const patch = (tok, body) =>
    call('PATCH', `/api/bookings/${bookingId}/status`, { token: tok, body });

  r = await call('POST', '/api/bookings', { token: customer.token, body: bookingBody });
  check('duplicate active request → 409', r.status === 409, `(got ${r.status})`);

  r = await patch(tech.token, { status: 'in-progress' });
  check('requested → in-progress is illegal → 400', r.status === 400, `(got ${r.status})`);

  r = await patch(otherTech.token, { status: 'accepted' });
  check('other technician cannot change status → 403', r.status === 403, `(got ${r.status})`);

  r = await patch(tech.token, { status: 'accepted' });
  check('own technician accepts → 200', r.status === 200, `(got ${r.status})`);

  r = await call('POST', '/api/bookings', { token: customer.token, body: bookingBody });
  check('duplicate while accepted → 409', r.status === 409, `(got ${r.status})`);

  r = await patch(tech.token, { status: 'in-progress' });
  check('accepted → in-progress → 200', r.status === 200, `(got ${r.status})`);

  r = await patch(tech.token, { status: 'completed', finalAmount: 0 });
  check('complete with finalAmount 0 → 400', r.status === 400, `(got ${r.status})`);
  r = await patch(tech.token, { status: 'completed', finalAmount: -5 });
  check('complete with finalAmount -5 → 400', r.status === 400, `(got ${r.status})`);
  r = await patch(tech.token, { status: 'completed', finalAmount: 55 });
  check('complete with finalAmount 55 → 200', r.status === 200, `(got ${r.status})`);

  r = await call('PATCH', `/api/bookings/${bookingId}/cancel`, { token: customer.token });
  check('cancel after completed → 400', r.status === 400, `(got ${r.status})`);


  r = await call('POST', '/api/bookings', { token: customer.token, body: bookingBody });
  check('re-request after completion allowed (no longer active) → 201',
    r.status === 201 || r.status === 200, `(got ${r.status})`);
  const booking2Id = r.json?.data?._id || r.json?.data?.id || r.json?._id;

  r = await call('POST', '/api/payments/create-checkout-session', {
    token: tech.token,
    body: { bookingId: booking2Id },
  });
  check('technician cannot start checkout → 403', r.status === 403, `(got ${r.status})`);

  r = await call('POST', '/api/payments/create-checkout-session', {
    token: customer.token,
    body: { bookingId: booking2Id },
  });
  check('checkout for requested booking → 400 (payment gate)', r.status === 400, `(got ${r.status})`);

  r = await call('PATCH', `/api/bookings/${booking2Id}/cancel`, { token: customer.token });
  check('cancel while requested → 200', r.status === 200, `(got ${r.status})`);

  r = await patch(tech.token, { status: 'accepted' });
  check('accept a cancelled booking → 400 (terminal)', r.status === 400, `(got ${r.status})`);


  console.log('\n4) Server-side search / filter / sort / pagination');

  const pickList = (j) => (Array.isArray(j?.data) ? j.data : j?.services || j?.data?.services || []);

  r = await call('GET', '/api/services?search=phone&limit=48');
  const searchHits = pickList(r.json);
  check(`search "phone" returns only matches (n=${r.json?.total ?? '?'})`,
    searchHits.length > 0 &&
    searchHits.every((s) => (s.title + ' ' + s.category).toLowerCase().includes('phone')));

  r = await call('GET', '/api/services?category=AC&limit=48');
  const acList = pickList(r.json);
  check('category=AC returns only AC services', acList.length > 0 && acList.every((s) => s.category === 'AC'));

  r = await call('GET', '/api/services?serviceMode=Home%20Visit&limit=48');
  const hv = pickList(r.json);
  check('serviceMode filter works', hv.length > 0 && hv.every((s) => s.serviceMode === 'Home Visit'));

  r = await call('GET', '/api/services?sort=price-asc&limit=48');
  const asc = pickList(r.json);
  check('sort=price-asc is ascending', asc.every((s, i) => i === 0 || asc[i - 1].basePrice <= s.basePrice));

  r = await call('GET', '/api/services?sort=price-desc&limit=48');
  const desc = pickList(r.json);
  check('sort=price-desc starts with the max price', desc.length > 0 && desc[0].basePrice === Math.max(...asc.map((s) => s.basePrice)));

  r = await call('GET', '/api/services?sort=newest&limit=48');
  const newest = pickList(r.json);
  check('sort=newest is createdAt-descending',
    newest.every((s, i) => i === 0 || new Date(newest[i - 1].createdAt) >= new Date(s.createdAt)));

  r = await call('GET', '/api/services?page=1&limit=5');
  check(`pagination: limit=5 returns 5 of ${r.json?.total ?? '?'}`,
    pickList(r.json).length === 5);


  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const ids = [bookingId, booking2Id].filter(Boolean);
  const out = await client
    .db(process.env.DB_NAME || 'fixmate')
    .collection('bookings')
    .deleteMany({ _id: { $in: ids.map((id) => (ObjectId.isValid(id) ? new ObjectId(id) : id)) } });
  await client.close();
  console.log(`\n[cleanup] removed ${out.deletedCount} test booking(s)`);

  console.log(`\n================ ${passed} passed, ${failed} failed ================`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('[live] FATAL:', e.message);
  process.exit(1);
});
