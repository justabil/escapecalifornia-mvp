// routes/router_admin.js
const express = require('express');
const router = express.Router();

const admin = require('../controllers/adminController');
const requireAdmin = require('../middleware/requireAdmin');

// Auth
router.get('/login', admin.showLogin);
router.post('/login', admin.doLogin);
router.post('/logout', requireAdmin, admin.logout);

// Admin dashboard
router.get('/', requireAdmin, admin.dashboard);

// A1: Leads CSV export (supports query params like ?days=30&state=TX&type=business)
router.get('/leads.csv', requireAdmin, admin.exportLeadsCsv);

// A2: Update admin notes (uses relocation_leads.admin_notes)
router.post('/leads/:id/notes', requireAdmin, admin.updateLeadNotes);

module.exports = router;
