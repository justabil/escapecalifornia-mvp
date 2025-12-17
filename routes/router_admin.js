// routes/router_admin.js
const express = require('express');
const router = express.Router();

const admin = require('../controllers/adminController');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/login', admin.showLogin);
router.post('/login', admin.doLogin);
router.post('/logout', requireAdmin, admin.logout);

router.get('/', requireAdmin, admin.dashboard);

module.exports = router;
