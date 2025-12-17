// controllers/partnersController.js
const pool = require('../db/pool');

exports.showPartnersForm = (req, res) => {
  res.render('partners', { csrfToken: req.csrfToken() });
};

exports.submitPartnerApplication = async (req, res) => {
  try {
    const {
      name, email, phone, partner_type,
      city_from, city_to, timeline, message,
      // anything else you collect:
      ...extras
    } = req.body;

    // Put extra/unexpected fields into JSON data
    const data = Object.keys(extras).length ? JSON.stringify(extras) : null;

    await pool.query(
      `INSERT INTO submissions
        (type, name, email, phone, partner_type, city_from, city_to, timeline, message, status, data)
       VALUES
        ('partner', ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
      [name || null, email || null, phone || null, partner_type || null,
       city_from || null, city_to || null, timeline || null, message || null, data]
    );

    res.render('partners_thankyou');
  } catch (err) {
    console.error('Partner apply error:', err);
    res.status(500).send('Server error');
  }
};
