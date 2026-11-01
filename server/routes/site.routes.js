'use strict';
/**
 * Site content endpoints: stats, facts, ticker and the contact form.
 */
const express = require('express');
const { tables } = require('../db');
const { TICKER } = require('../data');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* GET /api/site/stats — hero stickers + breed counter (was hardcoded 170+) */
router.get('/stats', (req, res) => {
  const breeds = tables.breeds.count.get().n;
  const ratings = tables.db.prepare('SELECT COUNT(*) AS n FROM ratings').get().n;
  const favorites = tables.db.prepare('SELECT COUNT(*) AS n FROM favorites').get().n;
  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    data: {
      breeds,
      ratings,
      favorites,
      source: (tables.meta.get.get('breeds_source') || {}).value || 'static',
      stickers: [
        { value: `${breeds}`, label: 'Breeds indexed' },
        { value: '∞', label: 'Good boys' },
        { value: '0', label: 'Soft shadows' },
      ],
    },
  });
});

/* GET /api/site/facts — Loud Facts section */
router.get('/facts', (req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ data: tables.facts.all.all() });
});

/* GET /api/site/ticker — marquee lines */
router.get('/ticker', (req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ data: TICKER });
});

/* POST /api/site/contact */
router.post('/contact', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 80);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const message = String(body.message || '').trim().slice(0, 2000);

  const errors = [];
  if (name.length < 2) errors.push('NAME_TOO_SHORT');
  if (!EMAIL_RE.test(email)) errors.push('EMAIL_INVALID');
  if (message.length < 10) errors.push('MESSAGE_TOO_SHORT');
  if (errors.length) {
    return res.status(422).json({ error: 'VALIDATION', message: 'Check the form and try again.', errors });
  }

  tables.messages.add.run({ name, email, body: message });
  res.status(201).json({ message: `Thanks ${name}! Your howl was received.` });
});

/* GET /api/site/messages — latest messages (owner view) */
router.get('/messages', (req, res) => {
  res.json({ data: tables.messages.latest.all(), total: tables.messages.count.get().n });
});

module.exports = router;
