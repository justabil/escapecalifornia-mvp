/**
 * ============================
 * REQUIRES & ENV
 * ============================
 */
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');


/**
 * ============================
 * APP SETUP
 * ============================
 */
const app = express();
app.set('trust proxy', 1);


/**
 * ============================
 * VIEW ENGINE
 * ============================
 */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


/**
 * ============================
 * CORE MIDDLEWARE
 * ============================
 */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


/**
 * ============================
 * COOKIES & SESSIONS
 * ============================
 */
app.use(cookieParser());

app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true, // ensures session exists on first visit
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false           // must be false while on HTTP
  }
}));


/**
 * ============================
 * CSRF PROTECTION (csrf-csrf)
 * ============================
 */
const {
  doubleCsrfProtection,
  generateCsrfToken
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.sessionID || '',
  cookieName: 'ec_csrf',
  cookieOptions: {
    sameSite: 'lax',
    secure: false,
    httpOnly: true,
    path: '/'
  },
  getCsrfTokenFromRequest: (req) => (req.body && req.body._csrf) || ''
});


/**
 * ============================
 * CSRF VALIDATION (POST/PUT/DELETE)
 * ============================
 */
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
});


/**
 * ============================
 * LOCALS FOR VIEWS
 * ============================
 */
app.use((req, res, next) => {
  res.locals.isAdmin = !!req.session?.isAdmin;

  if (req.method === 'GET') {
    res.locals.csrfToken = generateCsrfToken(req, res);
  }

  next();
});


/**
 * ============================
 * ROUTES
 * ============================
 */

// Public homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Routers
const adminRouter = require('./routes/router_admin');
const partnersRouter = require('./routes/router_partners');

app.use('/admin', adminRouter);
app.use('/partners', partnersRouter);


/**
 * ============================
 * ERROR HANDLING
 * ============================
 */
app.use((err, req, res, next) => {
  if (err && (err.name === 'ForbiddenError' || err.code === 'EBADCSRFTOKEN')) {
    return res
      .status(403)
      .send('Forbidden (CSRF): invalid or missing token. Please refresh and try again.');
  }
  next(err);
});


/**
 * ============================
 * START SERVER
 * ============================
 */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
