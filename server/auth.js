'use strict';
/**
 * Session-based auth helpers (httpOnly cookie + bearer token for API clients).
 */
const crypto = require('crypto');
const { tables } = require('./db');

const COOKIE_NAME = 'dogesh_session';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 24) * 3600 * 1000;
const REMEMBER_TTL_MS = Number(process.env.REMEMBER_TTL_DAYS || 30) * 86400 * 1000;

const isProd = process.env.NODE_ENV === 'production';

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: maxAgeMs,
});

function createSession(userId, { remember = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  tables.sessions.create.run({ token, user_id: userId, expires_at: Date.now() + ttl });
  return { token, expiresAt: Date.now() + ttl, ttl };
}

function readToken(req) {
  const fromCookie = req.cookies && req.cookies[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function resolveSession(req) {
  const token = readToken(req);
  if (!token) return null;
  const row = tables.sessions.byToken.get(token, Date.now());
  if (!row) return null;
  /* rolling expiry: refresh the session on activity */
  tables.sessions.touch.run(Date.now() + SESSION_TTL_MS, token);
  return {
    token,
    user: { id: row.user_id, email: row.email, fullName: row.full_name },
  };
}

function destroySession(req, res) {
  const token = readToken(req);
  if (token) tables.sessions.deleteByToken.run(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/** Express middleware: attaches req.session / req.user, 401 when required. */
function authenticate({ required = false } = {}) {
  return (req, res, next) => {
    req.session = resolveSession(req);
    req.user = req.session ? req.session.user : null;
    if (required && !req.user) {
      return res.status(401).json({ error: 'LOGIN_REQUIRED', message: 'Sign in to do that.' });
    }
    next();
  };
}

/* ---------------- validation ---------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateSignUp({ name, email, password }) {
  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push('NAME_TOO_SHORT');
  if (!email || !EMAIL_RE.test(String(email).trim())) errors.push('EMAIL_INVALID');
  if (!password || String(password).length < 8) errors.push('PASSWORD_TOO_SHORT');
  return { ok: errors.length === 0, errors, value: {
    name: String(name || '').trim().slice(0, 80),
    email: String(email || '').trim().toLowerCase().slice(0, 200),
    password: String(password || ''),
  } };
}

function setSessionCookie(res, session, remember) {
  res.cookie(COOKIE_NAME, session.token, cookieOptions(remember ? REMEMBER_TTL_MS : SESSION_TTL_MS));
}

module.exports = {
  COOKIE_NAME,
  createSession,
  destroySession,
  resolveSession,
  authenticate,
  validateSignUp,
  setSessionCookie,
};
