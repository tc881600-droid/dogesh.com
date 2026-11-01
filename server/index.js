'use strict';
/**
 * Dogesh.com — full-stack entry point.
 *
 *   Express  -> REST API (/api/*) + static frontend (public/)
 *   SQLite   -> users, sessions, breeds, favorites, ratings, facts, messages
 *   dog.ceo  -> proxied + cached server-side (browser never calls it directly)
 */
require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { tables } = require('./db');
const { authenticate } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ---------------- security headers ---------------- */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dogesh-dev-secret'));

/* ---------------- API routes ---------------- */
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/breeds', require('./routes/breeds.routes'));
app.use('/api/dog', require('./routes/dog.routes'));
app.use('/api/site', require('./routes/site.routes'));

/* GET /api — self-documenting index */
app.get('/api', (req, res) => {
  res.json({
    name: 'Dogesh.com API',
    version: '1.0.0',
    auth: 'httpOnly cookie session (dogesh_session) or Authorization: Bearer <token>',
    endpoints: {
      'GET  /api/site/stats': 'breed count, ratings, favourites, hero stickers',
      'GET  /api/site/facts': 'loud facts',
      'GET  /api/site/ticker': 'marquee lines',
      'POST /api/site/contact': '{ name, email, message }',
      'GET  /api/breeds?search=&limit=&offset=': 'paginated breed index',
      'GET  /api/breeds/featured': 'hall of fame',
      'GET  /api/breeds/favorites': "signed-in user's pack (auth)",
      'GET  /api/breeds/:id': 'one breed',
      'POST /api/breeds/:id/rate': '{ score: 1-10 } (auth)',
      'POST /api/breeds/:id/favorite': 'toggle favourite (auth)',
      'GET  /api/dog/random?count=3': 'proxied random dog image URL(s)',
      'GET  /api/dog/breed/:breed/:sub?': 'proxied breed photo',
      'POST /api/auth/signup': '{ name, email, password }',
      'POST /api/auth/login': '{ email, password, remember }',
      'POST /api/auth/logout': 'end session',
      'GET  /api/auth/me': 'current user + favourite ids',
    },
  });
});

/* GET /api/health */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    breeds: tables.breeds.count.get().n,
    users: tables.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    time: new Date().toISOString(),
  });
});

/* current user for the frontend shell (never 401s — returns null) */
app.get('/api/session', authenticate(), (req, res) => {
  res.json({ user: req.user || null });
});

/* ---------------- static frontend ---------------- */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: '5m' }));

/* SPA-ish fallback: any unknown non-API GET serves the shell */
app.get(/^\/(?!api\/).*/, (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

/* ---------------- errors ---------------- */
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: `No API route for ${req.method} ${req.path}` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[dogesh]', err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: 'SERVER_ERROR', message: 'Something went woof. Try again.' });
});

/* housekeeping: drop expired sessions every hour */
setInterval(() => {
  try { tables.sessions.purgeExpired.run(Date.now()); } catch { /* noop */ }
}, 3600 * 1000).unref();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🐶 Dogesh.com running at http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api`);
  });
}

module.exports = app;
