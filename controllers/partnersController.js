// controllers/partnersController.js
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db/pool');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

exports.showInviteSignup = async (req, res) => {
  try {
    const token = req.params.token;

    const [rows] = await pool.query(
      `SELECT id, email, expires_at, used_at
       FROM partner_invites
       WHERE token = ?
       LIMIT 1`,
      [token]
    );

    if (!rows.length) return res.status(404).send('Invalid invite link.');
    const inv = rows[0];

    if (inv.used_at) return res.status(400).send('This invite link was already used.');
    if (new Date(inv.expires_at).getTime() < Date.now()) return res.status(400).send('This invite link has expired.');

    return res.render('partners-invite', {
      csrfToken: res.locals.csrfToken,
      token,
      inviteEmail: inv.email,
      error: null
    });
  } catch (err) {
    console.error('showInviteSignup error:', err);
    return res.status(500).send('Server error');
  }
};

exports.doInviteSignup = async (req, res) => {
  try {
    const token = req.params.token;

    const [rows] = await pool.query(
      `SELECT id, email, expires_at, used_at
       FROM partner_invites
       WHERE token = ?
       LIMIT 1`,
      [token]
    );

    if (!rows.length) return res.status(404).send('Invalid invite link.');
    const inv = rows[0];

    if (inv.used_at) return res.status(400).send('This invite link was already used.');
    if (new Date(inv.expires_at).getTime() < Date.now()) return res.status(400).send('This invite link has expired.');

    const email = normalizeEmail(inv.email);
    const company_name = String(req.body.company_name || '').trim();
    const contact_name = String(req.body.contact_name || '').trim();
    const password = String(req.body.password || '');

    if (!company_name || password.length < 10) {
      return res.status(400).render('partners-invite', {
        csrfToken: res.locals.csrfToken,
        token,
        inviteEmail: inv.email,
        error: 'Please enter a company name and a password (10+ characters).'
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Create partner
    await pool.query(
      `INSERT INTO partners (email, password_hash, company_name, contact_name, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [email, password_hash, company_name, contact_name || null]
    );

    // Mark invite used
    await pool.query(
      `UPDATE partner_invites SET used_at = NOW() WHERE id = ?`,
      [inv.id]
    );

    return res.redirect('/partners/login');
  } catch (err) {
    // Duplicate email etc.
    console.error('doInviteSignup error:', err);
    return res.status(500).send('Server error creating partner account');
  }
};

exports.showLogin = (req, res) => {
  res.render('partners-login', {
    csrfToken: res.locals.csrfToken,
    error: null
  });
};

exports.doLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    const [rows] = await pool.query(
      `SELECT id, email, password_hash, status, company_name
       FROM partners
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).render('partners-login', {
        csrfToken: res.locals.csrfToken,
        error: 'Invalid email or password'
      });
    }

    const p = rows[0];
    if (p.status !== 'active') {
      return res.status(403).render('partners-login', {
        csrfToken: res.locals.csrfToken,
        error: 'Account disabled'
      });
    }

    const ok = await bcrypt.compare(password, p.password_hash);
    if (!ok) {
      return res.status(401).render('partners-login', {
        csrfToken: res.locals.csrfToken,
        error: 'Invalid email or password'
      });
    }

    req.session.partnerId = p.id;
    req.session.partnerEmail = p.email;
    req.session.partnerCompany = p.company_name;

    return res.redirect('/partners/dashboard');
  } catch (err) {
    console.error('partner login error:', err);
    return res.status(500).send('Server error');
  }
};

exports.logout = (req, res) => {
  delete req.session.partnerId;
  delete req.session.partnerEmail;
  delete req.session.partnerCompany;
  return res.redirect('/partners/login');
};

exports.dashboard = async (req, res) => {
  try {
    const partnerId = req.session.partnerId;

    // Redacted lead fields ONLY (2A)
    // Adjust these to match columns you actually have in relocation_leads.
    const [rows] = await pool.query(
      `
      SELECT
        rl.id,
        rl.created_at,
        rl.destination_state,
        rl.client_type,
        rl.admin_notes
      FROM lead_shares ls
      JOIN relocation_leads rl ON rl.id = ls.lead_id
      WHERE ls.partner_id = ?
      ORDER BY rl.created_at DESC
      LIMIT 200
      `,
      [partnerId]
    );

    return res.render('partners-dashboard', {
      partnerCompany: req.session.partnerCompany || 'Partner',
      leads: rows
    });
  } catch (err) {
    console.error('partner dashboard error:', err);
    return res.status(500).send('Server error');
  }
};
