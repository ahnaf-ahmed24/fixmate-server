module.exports = async (req, res) => {
  res.status(200).json({ ok: true, message: 'test route works', env: !!process.env.MONGODB_URI });
};
