// controllers/adminController.js
const pool = require('../db/pool');

/**
 * GET /admin/login
 */
exports.showLogin = (req, res) => {
  res.render('admin-login', {
    csrfToken: res.locals.csrfToken,
    error: null
  });
};

/**
 * POST /admin/login
 */
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

/**
 * POST /admin/logout
 */
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
};

/**
 * GET /admin
 * Admin dashboard: shows leads + stats + top states
 */
exports.dashboard = async (req, res) => {
  try {
    // Detect columns so we don't break if schema differs
    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));

    // A4: Stats + Top destination states (only if columns exist)
    let topDestinations = [];

if (colSet.has('city_to')) {
  const [rows] = await pool.query(`
    SELECT city_to AS destination, COUNT(*) AS cnt
    FROM relocation_leads
    WHERE city_to IS NOT NULL AND city_to <> ''
    GROUP BY city_to
    ORDER BY cnt DESC
    LIMIT 10
  `);
  topDestinations = rows;
}

    if (colSet.has('city_to')) {
      const [rows] = await pool.query(`
        SELECT city_to AS state, COUNT(*) AS cnt
        FROM relocation_leads
        WHERE city_to IS NOT NULL AND city_to <> ''
        GROUP BY city_to
        ORDER BY cnt DESC
        LIMIT 10
      `);
      topStates = rows;
    }

    // Leads list (safe ORDER BY depending on schema)
    const orderCol = colSet.has('created_at') ? 'created_at' : 'id';

    const [leads] = await pool.query(
      `SELECT * FROM relocation_leads ORDER BY ${orderCol} DESC LIMIT 200`
    );

    return res.render('admin_dashboard', {
      leads,
      stats,
      topStates,
      csrfToken: res.locals.csrfToken
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return res.status(500).send('Server error loading admin dashboard');
  }
};

/**
 * GET /admin/leads.csv
 * A1: CSV Export with optional filters:
 *   ?days=30&state=TX&type=business
 */
exports.exportLeadsCsv = async (req, res) => {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));

    const days = Number(req.query.days || 0);
    const state = (req.query.state || '').trim();
    const type = (req.query.type || '').trim();

    let sql = `SELECT * FROM relocation_leads WHERE 1=1`;
    const params = [];

    if (days > 0 && Number.isFinite(days) && colSet.has('created_at')) {
      sql += ` AND created_at >= NOW() - INTERVAL ? DAY`;
      params.push(days);
    }

    // City-to filter (your table has city_to)
if (state && colSet.has('city_to')) {
  sql += ` AND city_to = ?`;
  params.push(state);
}


    // Apply if your table has `type` (ENUM: individual|family|business)
if (type && colSet.has('type')) {
  sql += ` AND type = ?`;
  params.push(type);
}

    sql += ` ORDER BY ${colSet.has('created_at') ? 'created_at' : 'id'} DESC LIMIT 5000`;

    const [rows] = await pool.query(sql, params);

    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = rows.length ? Object.keys(rows[0]) : [];
    const lines = [header.map(esc).join(',')];

    for (const r of rows) {
      lines.push(header.map((k) => esc(r[k])).join(','));
    }

    const csv = lines.join('\r\n');

    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="relocation_leads_${ts}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).send('Server error exporting CSV');
  }
};

/**
 * POST /admin/leads/:id/notes
 * A2: Update admin notes (your column is admin_notes)
 */
exports.updateLeadNotes = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const adminNotes = (req.body.admin_notes || '').toString();

    if (!Number.isFinite(id)) return res.status(400).send('Bad id');

    // Optional safety: only update if the column exists
    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));
    if (!colSet.has('admin_notes')) {
      return res.status(500).send('Table missing admin_notes column');
    }

    await pool.query(`UPDATE relocation_leads SET admin_notes = ? WHERE id = ?`, [adminNotes, id]);
    return res.redirect('/admin');
  } catch (err) {
    console.error('Update admin_notes error:', err);
    return res.status(500).send('Server error updating notes');
  }
};
