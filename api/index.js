import handler from '../src/handler.js';

// Vercel function entry for the rewrite target in vercel.json ("/(.*)" → "/api/index").
// The real bootstrap lives in src/handler.js so it stays identical to the
// auto-detected root entry in src/app.js.
export default handler;
