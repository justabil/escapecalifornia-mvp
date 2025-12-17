// controllers/adminController.js
const pool = require('../db/pool');

exports.showLogin = (req, res) => {
  res.render('admin-login', {
    csrfToken: res.locals.csrfToken,
    error: null
  });

};

exports.doLogin = (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }

  return res.status(401).render('admin-login', {
    csrfToken: res.locals.csrfToken,
    error: 'Invalid password'
  });
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
};

exports.dashboard = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM relocation_leads ORDER BY created_at DESC LIMIT 200'
  );
  res.render('admin_dashboard', {
    leads: rows,
    csrfToken: res.locals.csrfToken
  });
};
