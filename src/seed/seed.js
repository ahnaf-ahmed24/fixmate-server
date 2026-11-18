
require('dotenv').config();
const { connectDb, collections, disconnectDb, ensureIndexes } = require('../config/db');
const { getAuth } = require('../lib/auth');

const ADMIN = { name: 'FixMate Admin', email: 'admin@fixmate.com', password: 'Admin@123' };
const TECHNICIANS = [
  {
    name: 'Rakib Hasan',
    email: 'rakib@fixmate.com',
    password: 'Tech@123',
    phone: '+8801711223344',
    area: 'Dhanmondi, Dhaka',
    bio: 'Certified electronics technician with 8 years of experience in smartphone & laptop repair.',
  },
  {
    name: 'Sabbir Ahmed',
    email: 'sabbir@fixmate.com',
    password: 'Tech@123',
    phone: '+8801822334455',
    area: 'Mirpur, Dhaka',
    bio: 'Home appliance specialist — AC, refrigerator and washing machine servicing expert.',
  },
];
const CUSTOMERS = [
  {
    name: 'Nusrat Jahan',
    email: 'nusrat@fixmate.com',
    password: 'Cust@123',
    phone: '+8801933445566',
    area: 'Uttara, Dhaka',
    bio: 'FixMate customer since 2024.',
  },
  {
    name: 'Tanvir Islam',
    email: 'tanvir@fixmate.com',
    password: 'Cust@123',
    phone: '+8801644556677',
    area: 'Banani, Dhaka',
    bio: '',
  },
];

const img = (q) =>
  `https://images.unsplash.com/${q}?auto=format&fit=crop&w=900&q=60`;

const SERVICES = [
 
  { t: 'iPhone Screen Replacement', c: 'Smartphone', d: 'Cracked or dead-pixel display replaced with a genuine-grade panel. Includes glass, digitizer and full display calibration plus a 15-day service warranty.', i: img('photo-1511707171634-5f897ff02aa9'), p: 45, dur: '2-3 hours', m: 'Shop Drop-off', a: 'Dhanmondi, Dhaka' },
  { t: 'Android Phone Battery & Charging Port Repair', c: 'Smartphone', d: 'Battery health check, original-spec battery replacement and charging port cleaning or replacement for all major Android brands.', i: img('photo-1601784551446-20c9e07cdbdb'), p: 25, dur: '1-2 hours', m: 'Shop Drop-off', a: 'Dhanmondi, Dhaka' },
  { t: 'Laptop Full Servicing & Thermal Paste', c: 'Laptop & PC', d: 'Deep internal cleaning, fan servicing, thermal paste replacement, OS tune-up and a full hardware diagnostic report.', i: img('photo-1496181133206-80ce9b88a853'), p: 30, dur: '1 day', m: 'Shop Drop-off', a: 'Dhanmondi, Dhaka' },
  { t: 'Desktop PC Build & Upgrade', c: 'Laptop & PC', d: 'SSD/RAM upgrades, custom build assembly, cable management and BIOS optimization for gaming or office desktops.', i: img('photo-1587831990711-23ca6441447b'), p: 35, dur: '3-4 hours', m: 'Home Visit', a: 'Dhanmondi & nearby areas' },
  { t: 'TV Panel & Backlight Repair', c: 'TV', d: 'LED/LCD backlight strip replacement, panel diagnosis and motherboard-level repair with a picture-quality guarantee.', i: img('photo-1593359677879-a4bb92f829d1'), p: 40, dur: '1 day', m: 'Home Visit', a: 'Dhanmondi, Dhaka' },
  
  { t: 'AC Deep Cleaning & Gas Refill', c: 'AC', d: 'Full indoor/outdoor unit wash, jet-spray coil cleaning, drain flushing, gas pressure check and top-up for split ACs.', i: img('photo-1631545806609-5b4b3c36a1c4'), p: 28, dur: '2-3 hours', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'AC Installation & Uninstallation', c: 'AC', d: 'Professional split-AC install or removal with proper wall mounting, copper pipe fitting, vacuuming and leak testing.', i: img('photo-1621905252507-b35492cc74b4'), p: 50, dur: '2-3 hours', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'Refrigerator Compressor & Cooling Repair', c: 'Refrigerator', d: 'No-cooling and over-freezing fixes: compressor service, gas refilling, thermostat replacement and drain cleaning.', i: img('photo-1571175443880-49e1d25b2bc5'), p: 38, dur: '1 day', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'Washing Machine Repair & Servicing', c: 'Washing Machine', d: 'Drum noise, drainage, spinning and vibration issues fixed — belt, bearing, inlet valve and pump repair for all brands.', i: img('photo-1624704167489-bb1f5b4d6bd3'), p: 26, dur: '2-3 hours', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'Microwave Oven Repair', c: 'Washing Machine', d: '', hidden: true },
  { t: 'House Electrical Wiring & Safety Check', c: 'Electrical', d: 'Complete house wiring inspection, socket/switch replacement, breaker upgrades and earthing safety correction.', i: img('photo-1621905251918-48416bd8575a'), p: 22, dur: '3-4 hours', m: 'Home Visit', a: 'Mirpur & nearby areas' },
  { t: 'Ceiling Fan & Light Fixture Installation', c: 'Electrical', d: 'Fan mounting, speed-controller wiring, chandelier and panel light installation with secure load testing.', i: img('photo-1565814329452-e1efa11c5b89'), p: 15, dur: '1-2 hours', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'Water Dispenser & Geyser Servicing', c: 'Refrigerator', d: 'Heating element replacement, tank descaling and thermostat repair for water dispensers and instant geysers.', i: img('photo-1523362628745-0c100150b504'), p: 20, dur: '1-2 hours', m: 'Home Visit', a: 'Mirpur, Dhaka' },
  { t: 'Printer Toner & Hardware Service', c: 'Laptop & PC', d: 'Paper jam mechanics, roller replacement, toner refill and head cleaning for laser and inkjet printers.', i: img('photo-1612815154858-60aa4c59eaa6'), p: 18, dur: '1-2 hours', m: 'Shop Drop-off', a: 'Mirpur, Dhaka', pending: true },
];

async function upsertUser(auth, { name, email, password, role, phone, area, bio }) {
  const { users } = collections();
  const existing = await users.findOne({ email });
  if (existing) return existing;

  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password,
      role: role === 'admin' ? 'customer' : role, // admin is seeded manually below
      ...(phone ? { phone } : {}),
      ...(area ? { area } : {}),
      ...(bio ? { bio } : {}),
    },
  });
  const user = await users.findOne({ email });
  if (role === 'admin' && user) {
    await users.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
    user.role = 'admin';
  }
  console.log(`[seed] user created: ${email} (${user?.role || role})`);
  return user;
}

async function main() {
  await connectDb();
  const { users, services, bookings, payments } = collections();
  const auth = getAuth();

  const admin = await users.findOne({ email: ADMIN.email });
  if (admin && admin.role === 'admin') {
    console.log('[seed] Seed data already exists — skipping. (Reset the database to re-seed.)');
    await disconnectDb();
    return;
  }

  console.log('[seed] creating users…');
  const adminUser = await upsertUser(auth, { ...ADMIN, role: 'admin' });
  const techs = [];
  for (const t of TECHNICIANS) techs.push(await upsertUser(auth, { ...t, role: 'technician' }));
  const customers = [];
  for (const c of CUSTOMERS) customers.push(await upsertUser(auth, { ...c, role: 'customer' }));

  console.log('[seed] creating services…');
  const now = Date.now();
  const serviceDocs = [];
  SERVICES.forEach((s, i) => {
    if (s.hidden) return;
    const tech = i < 5 ? techs[0] : techs[1];
    serviceDocs.push({
      title: s.t,
      category: s.c,
      description: s.d,
      image: s.i,
      basePrice: s.p,
      estimatedDuration: s.dur,
      serviceMode: s.m,
      serviceArea: s.a,
      technicianName: tech.name,
      technicianEmail: tech.email,
      approvalStatus: s.pending ? 'pending' : 'approved',
      isAvailable: true,
      createdAt: new Date(now - (SERVICES.length - i) * 86400000 * 1.5),
      updatedAt: new Date(now - (SERVICES.length - i) * 86400000 * 1.5),
    });
  });
  await services.deleteMany({});
  const inserted = await services.insertMany(serviceDocs);
  Object.entries(inserted.insertedIds).forEach(([i, id]) => {
    serviceDocs[Number(i)]._id = id;
  });
  const countCreated = serviceDocs.filter((s) => s._id).length;
  console.log(`[seed] ${countCreated} services created`);

  const svc = (title) => serviceDocs.find((s) => s.title === title);

  console.log('[seed] creating bookings…');
  await bookings.deleteMany({});
  await payments.deleteMany({});

  const mkBooking = (opts) => ({
    serviceId: opts.service._id.toString(),
    serviceTitle: opts.service.title,
    serviceImage: opts.service.image,
    category: opts.service.category,
    basePrice: opts.service.basePrice,
    technicianName: opts.service.technicianName,
    technicianEmail: opts.service.technicianEmail,
    customerName: opts.customer.name,
    customerEmail: opts.customer.email,
    customerPhone: opts.customer.phone || '+8801700000000',
    address: opts.address,
    preferredDate: opts.preferredDate,
    problemDescription: opts.problem,
    status: opts.status,
    finalAmount: opts.finalAmount ?? opts.service.basePrice,
    paymentStatus: 'unpaid',
    activeCheckoutSessionId: null,
    createdAt: opts.createdAt,
    updatedAt: opts.createdAt,
    statusHistory: opts.history || [{ status: opts.status, changedAt: opts.createdAt }],
  });

  const day = 86400000;
  const nusrat = customers[0];
  const tanvir = customers[1];

  const docs = [
    mkBooking({
      service: svc('iPhone Screen Replacement'), customer: nusrat,
      address: 'House 12, Road 5, Uttara Sector 7, Dhaka',
      preferredDate: new Date(now + 2 * day),
      problem: 'My iPhone 12 screen is cracked after a fall and the touch does not respond on the upper half.',
      status: 'requested', createdAt: new Date(now - day * 0.5),
    }),
    mkBooking({
      service: svc('AC Deep Cleaning & Gas Refill'), customer: nusrat,
      address: 'House 12, Road 5, Uttara Sector 7, Dhaka',
      preferredDate: new Date(now + 3 * day),
      problem: 'The bedroom AC cools very slowly and makes a rattling noise. It has not been serviced in two years.',
      status: 'accepted', createdAt: new Date(now - day * 2),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 2) },
        { status: 'accepted', changedAt: new Date(now - day * 1.5) },
      ],
    }),
    mkBooking({
      service: svc('Laptop Full Servicing & Thermal Paste'), customer: tanvir,
      address: 'Flat B4, House 30, Road 11, Banani, Dhaka',
      preferredDate: new Date(now + day),
      problem: 'Laptop overheats and shuts down while gaming. Fan spins loudly all the time.',
      status: 'in-progress', createdAt: new Date(now - day * 3),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 3) },
        { status: 'accepted', changedAt: new Date(now - day * 2.8) },
        { status: 'in-progress', changedAt: new Date(now - day * 2.5) },
      ],
    }),
    mkBooking({
      service: svc('Refrigerator Compressor & Cooling Repair'), customer: nusrat,
      address: 'House 12, Road 5, Uttara Sector 7, Dhaka',
      preferredDate: new Date(now - day * 5),
      problem: 'Fridge stopped cooling, food is getting spoiled. It hums but the freezer has no frost at all.',
      status: 'completed', finalAmount: 42, createdAt: new Date(now - day * 6),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 6) },
        { status: 'accepted', changedAt: new Date(now - day * 5.8) },
        { status: 'in-progress', changedAt: new Date(now - day * 5.5) },
        { status: 'completed', changedAt: new Date(now - day * 5) },
      ],
    }),
    mkBooking({
      service: svc('Washing Machine Repair & Servicing'), customer: tanvir,
      address: 'Flat B4, House 30, Road 11, Banani, Dhaka',
      preferredDate: new Date(now - day * 8),
      problem: 'Washing machine drum does not spin and water stays inside after every cycle.',
      status: 'completed', finalAmount: 30, createdAt: new Date(now - day * 9),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 9) },
        { status: 'accepted', changedAt: new Date(now - day * 8.8) },
        { status: 'in-progress', changedAt: new Date(now - day * 8.5) },
        { status: 'completed', changedAt: new Date(now - day * 8) },
      ],
    }),
    mkBooking({
      service: svc('TV Panel & Backlight Repair'), customer: tanvir,
      address: 'Flat B4, House 30, Road 11, Banani, Dhaka',
      preferredDate: new Date(now + 5 * day),
      problem: 'TV turns on with sound but the screen stays completely black with faint images visible.',
      status: 'cancelled', createdAt: new Date(now - day * 1.2),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 1.2) },
        { status: 'cancelled', changedAt: new Date(now - day) },
      ],
    }),
    mkBooking({
      service: svc('House Electrical Wiring & Safety Check'), customer: nusrat,
      address: 'House 12, Road 5, Uttara Sector 7, Dhaka',
      preferredDate: new Date(now - day * 4),
      problem: 'Sparks come out of the kitchen socket whenever I plug in the toaster. Breaker trips often.',
      status: 'rejected', createdAt: new Date(now - day * 4.2),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 4.2) },
        { status: 'rejected', changedAt: new Date(now - day * 4) },
      ],
    }),
    mkBooking({
      service: svc('Desktop PC Build & Upgrade'), customer: tanvir,
      address: 'Flat B4, House 30, Road 11, Banani, Dhaka',
      preferredDate: new Date(now - day * 2),
      problem: 'PC randomly restarts under load and one RAM slot is not detected anymore.',
      status: 'completed', finalAmount: 55, createdAt: new Date(now - day * 2.5),
      history: [
        { status: 'requested', changedAt: new Date(now - day * 2.5) },
        { status: 'accepted', changedAt: new Date(now - day * 2.3) },
        { status: 'in-progress', changedAt: new Date(now - day * 2.2) },
        { status: 'completed', changedAt: new Date(now - day * 2) },
      ],
    }),
    mkBooking({
      service: svc('Ceiling Fan & Light Fixture Installation'), customer: tanvir,
      address: 'Flat B4, House 30, Road 11, Banani, Dhaka',
      preferredDate: new Date(now + 4 * day),
      problem: 'Two room lights flicker at night and one wall socket has no power at all since yesterday.',
      status: 'requested', createdAt: new Date(now - day * 0.3),
    }),
  ];

  const insertedBookings = await bookings.insertMany(docs);
  const ids = Object.values(insertedBookings.insertedIds);
  console.log(`[seed] ${docs.length} bookings created`);

  console.log('[seed] creating payments…');
  const paid1 = docs[3]; // fridge — paid by Nusrat
  const paid2 = docs[4]; // washing machine — paid by Tanvir
  await payments.insertMany([
    {
      bookingId: ids[3].toString(),
      serviceTitle: paid1.serviceTitle,
      customerName: paid1.customerName,
      customerEmail: paid1.customerEmail,
      technicianName: paid1.technicianName,
      technicianEmail: paid1.technicianEmail,
      amount: paid1.finalAmount,
      currency: 'usd',
      transactionId: 'pi_3SeedDemoFridge001',
      stripeSessionId: 'cs_seed_demo_fridge_001',
      paymentStatus: 'paid',
      paidAt: new Date(now - day * 4.8),
    },
    {
      bookingId: ids[4].toString(),
      serviceTitle: paid2.serviceTitle,
      customerName: paid2.customerName,
      customerEmail: paid2.customerEmail,
      technicianName: paid2.technicianName,
      technicianEmail: paid2.technicianEmail,
      amount: paid2.finalAmount,
      currency: 'usd',
      transactionId: 'pi_3SeedDemoWasher002',
      stripeSessionId: 'cs_seed_demo_washer_002',
      paymentStatus: 'paid',
      paidAt: new Date(now - day * 7.8),
    },
  ]);
  // mark those bookings paid + history Paid marker
  await bookings.updateOne({ _id: ids[3] }, { $set: { paymentStatus: 'paid' } });
  await bookings.updateOne({ _id: ids[4] }, { $set: { paymentStatus: 'paid' } });
  console.log('[seed] 2 payments created (revenue ready for the admin dashboard)');

  console.log('\n==================== TEST ACCOUNTS ====================');
  console.log(`Admin       → ${ADMIN.email} / ${ADMIN.password}`);
  console.log(`Technician  → ${TECHNICIANS[0].email} / ${TECHNICIANS[0].password}`);
  console.log(`Technician  → ${TECHNICIANS[1].email} / ${TECHNICIANS[1].password}`);
  console.log(`Customer    → ${CUSTOMERS[0].email} / ${CUSTOMERS[0].password}`);
  console.log(`Customer    → ${CUSTOMERS[1].email} / ${CUSTOMERS[1].password}`);
  console.log('=======================================================');

  await disconnectDb();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await disconnectDb();
  process.exit(1);
});
