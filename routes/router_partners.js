// routes/router_partners.js
const express = require('express');
const router = express.Router();
const partners = require('../controllers/partnersController');

// If you want CSRF on partners (recommended), keep it here:
// (server.js will attach csrf middleware globally or you can attach here if you prefer)

router.get('/', partners.showPartnersForm);
router.post('/', partners.submitPartnerApplication);

module.exports = router;
