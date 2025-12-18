// routes/router_partners.js
const express = require('express');
const router = express.Router();

const partners = require('../controllers/partnersController');
const requirePartner = require('../middleware/requirePartner');

// Invite-based signup (you email partners a token link)
router.get('/invite/:token', partners.showInviteSignup);
router.post('/invite/:token', partners.doInviteSignup);

// Partner login/logout
router.get('/login', partners.showLogin);
router.post('/login', partners.doLogin);
router.post('/logout', requirePartner, partners.logout);

// Partner dashboard (redacted leads shared to this partner only)
router.get('/dashboard', requirePartner, partners.dashboard);

module.exports = router;
