// ImgBB is the image host for service photos & avatars — the API key never leaves the server.
const env = require('../config/env');
const { ok, fail } = require('../utils/helpers');

const MAX_BYTES = 10 * 1024 * 1024; // 10MB (ImgBB's own limit is 32MB)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/**
 * POST /api/uploads/image   { image: "data:image/png;base64,…" | "<raw base64>" }
 * Proxies the image to ImgBB and returns its hosted URL.
 */
async function uploadImage(req, res) {
  if (!env.IMGBB_API_KEY) {
    return fail(res, 503, 'Image upload is not configured: set IMGBB_API_KEY in the server .env');
  }

  const raw = String(req.body?.image || '').trim();
  if (!raw) return fail(res, 400, 'image is required (base64 or a data URL)');

  // Accept "data:image/png;base64,AAAA…" or a plain base64 string.
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const mime = match ? match[1] : 'image/jpeg';
  const b64 = match ? match[2] : raw;

  if (!ALLOWED_TYPES.includes(mime)) {
    return fail(res, 400, `Unsupported image type: ${mime}`);
  }

  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes > MAX_BYTES) return fail(res, 413, 'Image is too large (max 10MB)');

  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) return fail(res, 400, 'image could not be decoded');

  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mime }), `upload.${mime.split('/')[1] || 'png'}`);

  let json;
  try {
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(env.IMGBB_API_KEY)}`,
      { method: 'POST', body: form }
    );
    json = await response.json();
  } catch (err) {
    console.error('[uploads] ImgBB request failed:', err.message);
    return fail(res, 502, 'Image upload failed: could not reach the image host');
  }

  if (!json?.success || !json?.data?.url) {
    console.error('[uploads] ImgBB error:', json?.error?.message || json?.status || json);
    return fail(res, 502, json?.error?.message || 'Image upload was rejected by the image host');
  }

  ok(res, {
    url: json.data.url,
    thumb: json.data.thumb?.url,
    deleteUrl: json.data.delete_url,
  });
}

module.exports = { uploadImage };
