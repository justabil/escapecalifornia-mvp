// controllers/adminController.js
const pool = require('../db/pool');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
 * POST /admin/partner-invite
 * Creates a new invite token and emails the partner an invite link
 */
exports.sendPartnerInvite = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).send('Missing email');

    // Generate secure token (64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');

    // Invite expiry (optional env var; default 14 days)
    const days = Number(process.env.PARTNER_INVITE_DAYS || 14);

    // Store invite
    await pool.query(
      `INSERT INTO partner_invites (token, email, expires_at)
       VALUES (?, ?, NOW() + INTERVAL ? DAY)`,
      [token, email, days]
    );

    // Build invite URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${baseUrl}/partners/invite/${token}`;

    // Reuse your existing SMTP config (.env)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'EscapeCalifornia Partner Invitation',
      text:
`You’ve been invited to join EscapeCalifornia as a partner.

Create your partner account here:
${inviteUrl}

This link expires in ${days} days.`
    });

    return res.redirect('/admin');
  } catch (err) {
    console.error('sendPartnerInvite error:', err);
    return res.status(500).send('Server error sending invite');
  }
};

/**
 * GET /admin
 * Admin dashboard: shows leads + stats + top destinations
 */
exports.dashboard = async (req, res) => {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));

    // A4: Stats (only if created_at exists)
    let stats = null;
    if (colSet.has('created_at')) {
      const [[s]] = await pool.query(`
        SELECT
          SUM(created_at >= CURDATE()) AS today,
          SUM(created_at >= CURDATE() - INTERVAL 7 DAY) AS last7,
          SUM(created_at >= CURDATE() - INTERVAL 30 DAY) AS last30,
          COUNT(*) AS total
        FROM relocation_leads
      `);
      stats = s;
    }

    // A4: Top Destination Cities (from city_to)
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

    // Leads list
    const orderCol = colSet.has('created_at') ? 'created_at' : 'id';
    const [leads] = await pool.query(
      `SELECT * FROM relocation_leads ORDER BY ${orderCol} DESC LIMIT 200`
    );

    return res.render('admin_dashboard', {
      leads,
      stats,
      topDestinations,
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
 *   ?days=30&city_to=Boise&type=business
 */
exports.exportLeadsCsv = async (req, res) => {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));

    const days = Number(req.query.days || 0);
    const cityTo = (req.query.city_to || '').trim();
    const type = (req.query.type || '').trim();

    let sql = `SELECT * FROM relocation_leads WHERE 1=1`;
    const params = [];

    if (days > 0 && Number.isFinite(days) && colSet.has('created_at')) {
      sql += ` AND created_at >= NOW() - INTERVAL ? DAY`;
      params.push(days);
    }

    if (cityTo && colSet.has('city_to')) {
      sql += ` AND city_to = ?`;
      params.push(cityTo);
    }

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
 * A2: Update admin notes (column is admin_notes)
 */
exports.updateLeadNotes = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const adminNotes = (req.body.admin_notes || '').toString();

    if (!Number.isFinite(id)) return res.status(400).send('Bad id');

    const [cols] = await pool.query(`SHOW COLUMNS FROM relocation_leads`);
    const colSet = new Set(cols.map((c) => c.Field));
    if (!colSet.has('admin_notes')) {
      return res.status(500).send('Table missing admin_notes column');
    }

    await pool.query(
      `UPDATE relocation_leads SET admin_notes = ? WHERE id = ?`,
      [adminNotes, id]
    );

    return res.redirect('/admin');
  } catch (err) {
    console.error('Update admin_notes error:', err);
    return res.status(500).send('Server error updating notes');
  }
};
