const { ok, fail, collections, userFilter } = require('../utils/helpers');


async function updateProfile(req, res) {
  const { users } = collections();
  const body = req.body || {};

  const $set = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return fail(res, 400, 'Name cannot be empty');
    if (name.length > 80) return fail(res, 400, 'Name is too long');
    $set.name = name;
  }
  if (body.phone !== undefined) $set.phone = String(body.phone).trim().slice(0, 30);
  if (body.area !== undefined) $set.area = String(body.area).trim().slice(0, 120);
  if (body.bio !== undefined) $set.bio = String(body.bio).trim().slice(0, 600);
  if (body.image !== undefined) $set.image = String(body.image).trim();

  await users.updateOne(userFilter(req.user.id), { $set });

  const updated = await users.findOne(
    userFilter(req.user.id),
    { projection: { name: 1, email: 1, image: 1, role: 1, phone: 1, area: 1, bio: 1, createdAt: 1 } }
  );

  ok(res, { data: updated, message: 'Profile updated successfully' });
}


async function getMe(req, res) {
  const { users } = collections();
  const user = await users.findOne(
    userFilter(req.user.id),
    { projection: { name: 1, email: 1, image: 1, role: 1, phone: 1, area: 1, bio: 1, createdAt: 1 } }
  );
  if (!user) return fail(res, 404, 'User not found');
  ok(res, { data: user });
}

module.exports = { updateProfile, getMe };
