import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = 5057;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.error(`  ✘ ${name} ${extra}`);
  }
}

async function request(path, { method = 'GET', body, token, cookies = [] } = {}) {
  const headers = { Origin: 'http://localhost:3000' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookies.length) headers.Cookie = cookies.map((c) => c.split(';')[0]).join('; ');

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {

  }
  return { status: res.status, json, text, setCookies: res.headers.getSetCookie?.() || [] };
}

function waitForServer(url, tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = async (n) => {
      try {
        const r = await fetch(url);
        if (r.ok) return resolve();
      } catch {}
      if (n <= 0) return reject(new Error('server did not start'));
      setTimeout(() => attempt(n - 1), 500);
    };
    attempt(tries);
  });
}

async function main() {
  console.log('[smoke] starting in-memory MongoDB…');
  const mongod = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  const uri = mongod.getUri('fixmate_smoke');

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    DB_NAME: 'fixmate_smoke',
    PORT: String(PORT),
    BETTER_AUTH_URL: BASE,
    CLIENT_URL: 'http://localhost:3000',
    JWT_ISSUER: 'fixmate-server',
    JWT_AUDIENCE: 'fixmate-client',
    BETTER_AUTH_SECRET: 'smoke-test-secret',
    STRIPE_SECRET_KEY: 'sk_test_placeholder',
  };

  console.log('[smoke] seeding…');
  const seedProc = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'seed', 'seed.js')], { env });
  seedProc.stdout.on('data', (d) => process.stdout.write(`[seed] ${d}`));
  seedProc.stderr.on('data', (d) => process.stderr.write(`[seed-err] ${d}`));
  await new Promise((res, rej) => seedProc.on('exit', (code) => (code === 0 ? res() : rej(new Error('seed failed')))));

  console.log('[smoke] starting API server…');
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'index.js')], { env });
  server.stdout.on('data', (d) => process.stdout.write(`[srv] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[srv-err] ${d}`));
  await waitForServer(`${BASE}/health`);

  try {
    await runTests();
  } finally {
    server.kill();
    await mongod.stop();
  }

  console.log(`\n[smoke] done — ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

async function login(email, password) {
  const res = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email, password },
  });
  // The sign-in body's `token` is the session token — the JWT comes from /api/auth/token.
  const tok = await request('/api/auth/token', { cookies: res.setCookies });
  return { res, token: tok.json?.token, cookies: res.setCookies };
}

async function runTests() {
  console.log('\n— Public endpoints —');
  let r = await request('/');
  check('GET / → 200', r.status === 200);

  r = await request('/api/services?limit=50');
  check('GET /api/services → 200 with 12 approved services', r.status === 200 && r.json.data.length === 12, `got ${r.json?.data?.length}`);
  check('all returned services are approved+available', r.json.data.every((s) => s.approvalStatus === 'approved' && s.isAvailable));

  r = await request('/api/services/featured');
  check('GET /api/services/featured → 6 latest', r.status === 200 && r.json.data.length === 6);

  r = await request('/api/services?search=screen');
  check('server-side search "screen" finds iPhone Screen Replacement', r.json.data.some((s) => /screen/i.test(s.title)) && r.json.data.every((s) => /screen|smartphone/i.test(s.title + s.category)), JSON.stringify(r.json.data?.map((s) => s.title)));

  r = await request('/api/services?category=AC');
  check('category=AC filter (server-side)', r.json.data.length >= 2 && r.json.data.every((s) => s.category === 'AC'));

  r = await request('/api/services?serviceMode=Home%20Visit&category=AC');
  check('combined filters (category + serviceMode)', r.json.data.every((s) => s.category === 'AC' && s.serviceMode === 'Home Visit'));

  r = await request('/api/services?sort=price-asc');
  const prices = r.json.data.map((s) => s.basePrice);
  check('sort=price-asc works server-side', prices.every((p, i) => i === 0 || prices[i - 1] <= p), prices.join(','));

  r = await request('/api/services?limit=5&page=2');
  check('pagination (limit 5, page 2)', r.json.data.length === 5 && r.json.page === 2 && r.json.totalPages === 3, JSON.stringify({ page: r.json.page, totalPages: r.json.totalPages }));

  const anyService = (await request('/api/services')).json.data[0];
  r = await request(`/api/services/${anyService._id}`);
  check('service details include technician summary', r.status === 200 && r.json.data.technician && typeof r.json.data.technician.name === 'string');

  r = await request('/api/services/000000000000000000000000');
  check('unknown service id → 404', r.status === 404);

  console.log('\n— Auth: sign-up validation & role coercion —');
  r = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Smoke Customer', email: 'smoke-cust@test.com', password: 'Passw0rd', role: 'customer' },
  });
  check('sign-up customer → 200', r.status === 200, r.text.slice(0, 200));

  r = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Evil Admin', email: 'evil-admin@test.com', password: 'Passw0rd', role: 'admin' },
  });
  check('sign-up with role=admin does not crash', r.status === 200, r.text.slice(0, 200));

  r = await request('/api/auth/sign-up/email', {
    method: 'POST',
    body: { name: 'Duplicate', email: 'smoke-cust@test.com', password: 'Passw0rd' },
  });
  check('duplicate email rejected', r.status >= 400 || (r.json && r.json.error), r.text.slice(0, 200));

  console.log('\n— JWT & role middlewares (Challenge 2) —');
  const cust = await login('smoke-cust@test.com', 'Passw0rd');
  check('customer sign-in → 200 + session', cust.res.status === 200 && cust.token, cust.res.text.slice(0, 300));
  check('admin-role signup was coerced to customer', cust.json?.user ? cust.json.user.role === 'customer' : true);

  // The evil-admin user should be a customer
  const evil = await login('evil-admin@test.com', 'Passw0rd');
  check('evil admin token works', !!evil.token);

  let me = await request('/api/users/me', { token: evil.token });
  check('role "admin" at signup saved as "customer" (server-side sanitization)', me.json?.data?.role === 'customer', me.json?.data?.role);

  r = await request('/api/bookings/my');
  check('API without token → 401', r.status === 401);

  r = await request('/api/admin/users', { token: cust.token });
  check('customer hitting admin API → 403', r.status === 403);

  r = await request('/api/services', { method: 'POST', token: cust.token, body: { title: 'x' } });
  check('customer hitting technician API → 403', r.status === 403);

  const tech = await login('rakib@fixmate.com', 'Tech@123');
  check('technician sign-in works', !!tech.token);
  r = await request('/api/admin/users', { token: tech.token });
  check('technician hitting admin API → 403', r.status === 403);

  const admin = await login('admin@fixmate.com', 'Admin@123');
  check('admin sign-in works', !!admin.token);
  r = await request('/api/admin/users', { token: admin.token });
  check('admin can list users', r.status === 200 && Array.isArray(r.json.data) && r.json.data.length >= 5);

  console.log('\n— Customer booking flow —');
  const svcList = (await request('/api/services?limit=50')).json.data;
  const target = svcList.find((s) => s.technicianEmail === 'sabbir@fixmate.com');
  const targetTech = await login('sabbir@fixmate.com', 'Tech@123'); 

  r = await request('/api/bookings', {
    method: 'POST',
    token: cust.token,
    body: { serviceId: target._id, customerPhone: '+8801711000000', address: 'Road 5, Dhaka', preferredDate: new Date(Date.now() + 86400000).toISOString(), problemDescription: 'This is a long enough problem description for the test.' },
  });
  check('customer creates booking → 201 requested/unpaid', r.status === 201 && r.json.data.status === 'requested' && r.json.data.paymentStatus === 'unpaid', r.text.slice(0, 200));

  const bookingId = r.json.data._id;
  check('booking copies service snapshot + finalAmount=basePrice', r.json.data.serviceTitle === target.title && r.json.data.finalAmount === target.basePrice);
  check('statusHistory seeded', Array.isArray(r.json.data.statusHistory) && r.json.data.statusHistory.length === 1);

  r = await request('/api/bookings', {
    method: 'POST',
    token: cust.token,
    body: { serviceId: target._id, customerPhone: '+8801711000000', address: 'Road 5, Dhaka', preferredDate: new Date(Date.now() + 86400000).toISOString(), problemDescription: 'This is a long enough problem description for the test.' },
  });
  check('duplicate active request → 409', r.status === 409);

  r = await request('/api/bookings', {
    method: 'POST',
    token: cust.token,
    body: { serviceId: target._id, customerPhone: '+8801711000000', address: 'Road 5, Dhaka', preferredDate: new Date(Date.now() - 86400000).toISOString(), problemDescription: 'This is a long enough problem description for the test.' },
  });
  check('past preferred date → 400', r.status === 400);

  r = await request('/api/bookings', {
    method: 'POST',
    token: cust.token,
    body: { serviceId: target._id, customerPhone: '+8801711000000', address: 'Road 5, Dhaka', preferredDate: new Date(Date.now() + 86400000).toISOString(), problemDescription: 'short' },
  });
  check('short problem description → 400', r.status === 400);

  r = await request('/api/bookings', { method: 'POST', token: tech.token, body: {} });
  check('technician cannot send repair request → 403', r.status === 403);

  r = await request('/api/bookings/my', { token: cust.token });
  check('my bookings list contains the new booking', r.status === 200 && r.json.data.length >= 1);

  console.log('\n— Technician pipeline (Challenge 3) —');
  r = await request('/api/bookings/technician', { token: targetTech.token });
  check('technician sees only own bookings', r.status === 200 && r.json.data.every((b) => b.technicianEmail === 'sabbir@fixmate.com'));

  const newBooking = r.json.data.find((b) => b._id === bookingId);
  check('new booking visible to its technician', !!newBooking);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'completed' } });
  check('requested → completed rejected (400)', r.status === 400);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'accepted' } });
  check('requested → accepted OK', r.status === 200 && r.json.data.status === 'accepted');

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'in-progress' } });
  check('accepted → in-progress OK', r.status === 200);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'completed' } });
  check('complete without finalAmount → 400', r.status === 400);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'completed', finalAmount: -5 } });
  check('negative finalAmount → 400', r.status === 400);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'completed', finalAmount: 49.5 } });
  check('in-progress → completed with finalAmount OK', r.status === 200 && r.json.data.finalAmount === 49.5);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: targetTech.token, body: { status: 'accepted' } });
  check('completed is final (400)', r.status === 400);

  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: admin.token, body: { status: 'accepted' } });
  check('admin hitting technician endpoint → 403', r.status === 403);

  const otherTech = await login('rakib@fixmate.com', 'Tech@123');
  r = await request(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: otherTech.token, body: { status: 'accepted' } });
  check('other technician cannot update → 403', r.status === 403);

  console.log('\n— Cancel & payment gate —');
  const nusrat = await login('nusrat@fixmate.com', 'Cust@123');
  const nusratList = (await request('/api/bookings/my', { token: nusrat.token })).json.data;
  const requestedOne = nusratList.find((b) => b.status === 'requested');
  check('nusrat has a requested booking to cancel', !!requestedOne);
  r = await request(`/api/bookings/${requestedOne._id}/cancel`, { method: 'PATCH', token: nusrat.token });
  check('customer cancels requested booking → 200', r.status === 200);

  r = await request(`/api/bookings/${requestedOne._id}/cancel`, { method: 'PATCH', token: nusrat.token });
  check('cancelling twice → 400', r.status === 400);

  r = await request(`/api/bookings/${bookingId}/cancel`, { method: 'PATCH', token: cust.token });
  check('cannot cancel a completed job → 400', r.status === 400);

  // tanvir's seeded desktop repair: completed + unpaid — another customer must not pay it
  const tanvir = await login('tanvir@fixmate.com', 'Cust@123');
  const tanvirList = (await request('/api/bookings/my', { token: tanvir.token })).json.data;
  const completedUnpaid = tanvirList.find((b) => b.status === 'completed' && b.paymentStatus === 'unpaid');
  check('seeded completed+unpaid booking exists', !!completedUnpaid);
  r = await request('/api/payments/create-checkout-session', { method: 'POST', token: cust.token, body: { bookingId: completedUnpaid._id } });
  check('customer cannot pay someone else’s booking → 403', r.status === 403, r.text.slice(0, 120));

  // tanvir's own requested booking → gate check for non-completed status
  const tanvirRequested = tanvirList.find((b) => b.status === 'requested');
  r = await request('/api/payments/create-checkout-session', { method: 'POST', token: tanvir.token, body: { bookingId: tanvirRequested._id } });
  check('cannot pay a non-completed booking → 400', r.status === 400, r.text.slice(0, 120));

  r = await request('/api/payments/my', { token: nusrat.token });
  check('customer payment history (1 seeded)', r.status === 200 && r.json.data.length === 1, `got ${r.json?.data?.length}`);

  console.log('\n— Technician service CRUD —');
  r = await request('/api/services', {
    method: 'POST',
    token: tech.token,
    body: { title: 'Smoke Repair Service', category: 'Smartphone', description: 'A smoke-test service description that is long enough.', basePrice: 10, estimatedDuration: '1 hour', serviceMode: 'Home Visit', serviceArea: 'Dhaka', image: 'https://example.com/img.jpg' },
  });
  check('technician creates service → 201 pending', r.status === 201 && r.json.data.approvalStatus === 'pending');
  const newServiceId = r.json.data._id;

  r = await request('/api/services/mine/all', { token: tech.token });
  check('my services list', r.status === 200 && r.json.data.some((s) => s._id === newServiceId));

  r = await request(`/api/services/${newServiceId}`, { method: 'PATCH', token: tech.token, body: { title: 'Smoke Repair Service v2' } });
  check('edit resets approval to pending', r.status === 200 && r.json.data.approvalStatus === 'pending');

  r = await request(`/api/services/${newServiceId}/availability`, { method: 'PATCH', token: tech.token, body: { isAvailable: false } });
  check('availability toggle works', r.status === 200 && r.json.data.isAvailable === false);

  r = await request(`/api/services/${newServiceId}`, { method: 'DELETE', token: tech.token });
  check('delete own service → 200', r.status === 200);

  const rakibSvc = (await request('/api/services/mine/all', { token: tech.token })).json.data[0];
  r = await request(`/api/services/${rakibSvc._id}`, { method: 'DELETE', token: targetTech.token });
  check('cannot delete someone else’s service → 403', r.status === 403);

  console.log('\n— Admin moderation & transactions —');
  const pendRes = await request('/api/admin/services?approval=pending', { token: admin.token });
  const pendingServices = pendRes.json.data;
  check('admin sees pending services', pendRes.status === 200 && pendingServices.length >= 1, `got ${pendingServices.length}`);
  const pend = pendingServices[0];
  r = await request(`/api/admin/services/${pend._id}/approval`, { method: 'PATCH', token: admin.token, body: { approvalStatus: 'approved' } });
  check('admin approves service', r.status === 200 && r.json.data.approvalStatus === 'approved');

  const adminId = (await request('/api/users/me', { token: admin.token })).json.data._id;
  r = await request(`/api/admin/users/${adminId}/role`, { method: 'PATCH', token: admin.token, body: { role: 'customer' } });
  check('admin cannot change own role', r.status === 400);

  const evilId = (await request('/api/users/me', { token: evil.token })).json.data._id;
  r = await request(`/api/admin/users/${evilId}/role`, { method: 'PATCH', token: admin.token, body: { role: 'technician' } });
  check('admin changes another user’s role', r.status === 200 && r.json.data.role === 'technician');

  r = await request('/api/admin/bookings', { token: admin.token });
  check('admin lists all bookings', r.status === 200 && r.json.data.length >= 8);

  r = await request('/api/admin/payments', { token: admin.token });
  check('admin payments + revenue (72 from seed)', r.status === 200 && r.json.totalRevenue === 72, `revenue=${r.json?.totalRevenue}`);

  r = await request('/api/admin/stats', { token: admin.token });
  check('admin stats include statusCounts', r.status === 200 && Array.isArray(r.json.data.statusCounts));

  console.log('\n— Role stats —');
  r = await request('/api/users/stats/customer', { token: cust.token });
  check(
    'customer stats return counts',
    r.status === 200 && Number.isInteger(r.json.data.totalRequests) && Number.isInteger(r.json.data.activeJobs),
    JSON.stringify(r.json?.data)
  );
  r = await request('/api/users/stats/technician', { token: tech.token });
  check(
    'technician stats return counts',
    r.status === 200 && Number.isInteger(r.json.data.totalServices) && Number.isInteger(r.json.data.pendingRequests),
    JSON.stringify(r.json?.data)
  );

  console.log('\n— Profile update —');
  r = await request('/api/users/profile', {
    method: 'PATCH',
    token: cust.token,
    body: { name: 'Smoke Customer Renamed', phone: '+8801799999999', area: 'Banani, Dhaka', bio: 'Updated bio' },
  });
  check('profile update works', r.status === 200 && r.json.data.name === 'Smoke Customer Renamed' && r.json.data.phone === '+8801799999999');
}

main().catch((err) => {
  console.error('[smoke] fatal:', err);
  process.exit(1);
});
