'use strict';
/**
 * Auth endpoints — replaces the Supabase bridge that used to live in the page.
 * Sessions are stored server-side (SQLite) and delivered via an httpOnly cookie.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, tables } = require('../db');
const {
  createSession, destroySession, authenticate, validateSignUp, setSessionCookie,
} = require('../auth');

const router = express.Router();

const shapeUser = (u) => ({ id: u.id, email: u.email, fullName: u.full_name || u.fullName });

const HUMAN = {
  NAME_TOO_SHORT: 'Name needs at least 2 characters.',
  EMAIL_INVALID: 'That does not look like an email address.',
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
};

/* POST /api/auth/signup */
router.post('/signup', (req, res) => {
  const check = validateSignUp(req.body || {});
  if (!check.ok) {
    return res.status(422).json({
      error: 'VALIDATION',
      message: check.errors.map((e) => HUMAN[e] || e).join(' '),
      errors: check.errors,
    });
  }
  const { name, email, password } = check.value;

  if (tables.users.byEmail.get(email)) {
    return res.status(409).json({ error: 'EMAIL_TAKEN', message: 'That email is already registered.' });
  }

  const info = tables.users.create.run({ email, full_name: name, password_hash: bcrypt.hashSync(password, 10) });
  const user = tables.users.byId.get(info.lastInsertRowid);
  const session = createSession(user.id, { remember: true });
  setSessionCookie(res, session, true);

  res.status(201).json({ user: shapeUser(user), message: 'Account created. Welcome to the archive.' });
});

/* POST /api/auth/login */
router.post('/login', (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const remember = !!body.remember;

  const row = email ? tables.users.byEmail.get(email) : null;
  const ok = !!row && bcrypt.compareSync(password, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' });
  }

  const session = createSession(row.id, { remember });
  setSessionCookie(res, session, remember);
  res.json({ user: shapeUser(row), message: 'Access granted. Welcome back!' });
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ message: 'Signed out. Woof.' });
});

/* GET /api/auth/me */
router.get('/me', authenticate(), (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'NOT_LOGGED_IN', message: 'No active session.' });
  const favorites = tables.favorites.idsForUser.all(req.user.id).map((r) => r.breed_id);
  res.json({ user: req.user, favorites });
});

/* PATCH /api/auth/me — update display name */
router.patch('/me', authenticate({ required: true }), (req, res) => {
  const name = String((req.body || {}).fullName || '').trim().slice(0, 80);
  if (name.length < 2) {
    return res.status(422).json({ error: 'VALIDATION', message: HUMAN.NAME_TOO_SHORT });
  }
  db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(name, req.user.id);
  res.json({ user: { ...req.user, fullName: name }, message: 'Profile updated.' });
});

module.exports = router;
