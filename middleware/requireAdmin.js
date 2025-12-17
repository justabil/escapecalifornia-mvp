// middleware/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
  console.log("bill...isadmin = true");
};
