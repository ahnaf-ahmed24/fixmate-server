const { MongoClient } = require('mongodb');
const env = require('./env');

let client = null;
let db = null;

async function connectDb() {
  if (db) return db;
  client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    appName: 'FixMateServer',
  });
  await client.connect();
  db = client.db(env.DB_NAME);
  await ensureIndexes(db);
  console.log(`[db] MongoDB connected → ${env.DB_NAME}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not connected yet');
  return db;
}


function collections() {
  const d = getDb();
  return {
    users: d.collection('users'), 
    sessions: d.collection('sessions'),
    accounts: d.collection('accounts'),
    verifications: d.collection('verifications'),
    jwks: d.collection('jwks'),
    services: d.collection('services'),
    bookings: d.collection('bookings'),
    payments: d.collection('payments'),
  };
}

async function ensureIndexes(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('services').createIndex({ technicianEmail: 1 });
  await db.collection('services').createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });
  await db.collection('bookings').createIndex({ customerEmail: 1, status: 1 });
  await db.collection('bookings').createIndex({ technicianEmail: 1, status: 1 });
  await db.collection('bookings').createIndex({ serviceId: 1, customerEmail: 1 });
  await db.collection('payments').createIndex({ stripeSessionId: 1 }, { unique: true });
  await db.collection('payments').createIndex({ bookingId: 1 }, { unique: true });
  await db.collection('payments').createIndex({ customerEmail: 1 });
}

async function disconnectDb() {
  if (client) await client.close();
  client = null;
  db = null;
}

module.exports = { connectDb, getDb, collections, disconnectDb, ensureIndexes };
