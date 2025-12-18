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

exports.exportLeadsCsv = async (req, res) => {
  try {
    const [rows] = await pool.query(`
  SELECT *
  FROM relocation_leads
  ORDER BY created_at DESC
  LIMIT 5000
`);
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      'id',
      'created_at',
      'name',
      'email',
      'client_type',
      'destination_state',
      'notes'
    ];

    const lines = [header.map(esc).join(',')];

    for (const r of rows) {
      lines.push([
        r.id,
        r.created_at ? new Date(r.created_at).toISOString() : '',
        r.name,
        r.email,
        r.client_type,
        r.destination_state,
        r.notes
      ].map(esc).join(','));
    }

    const csv = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="relocation_leads.csv"'
    );

    res.status(200).send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).send('Server error exporting CSV');
  }
};