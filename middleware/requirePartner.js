// middleware/requirePartner.js
module.exports = function requirePartner(req, res, next) {
  if (req.session && req.session.partnerId) return next();
  return res.redirect('/partners/login');
};