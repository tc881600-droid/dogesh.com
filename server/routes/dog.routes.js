'use strict';
/**
 * dog.ceo proxy — the browser no longer talks to third parties directly.
 * GET /api/dog/random            -> one random dog image URL
 * GET /api/dog/random?count=3     -> three random dog image URLs
 * GET /api/dog/breed/:breed       -> random image for a breed
 * GET /api/dog/breed/:breed/:sub  -> random image for a breed variant
 * GET /api/dog/list               -> raw breed list from the upstream API
 */
const express = require('express');
const { cachedJson } = require('../dogApi');

const router = express.Router();

const SAFE = /^[a-z-]+$/i;
const ok = (s) => typeof s === 'string' && SAFE.test(s);

/* generic passthrough with graceful fallback */
async function respond(req, res, pathname, fallbackCount = 1) {
  try {
    const json = await cachedJson(pathname);
    return res.json({ data: json.message, source: 'dog.ceo' });
  } catch (err) {
    const ids = Array.from({ length: fallbackCount }, (_, i) =>
      `https://placedog.net/640/480?id=${Math.floor(Math.random() * 150) + 1 + i}`);
    res.status(200).json({
      data: fallbackCount === 1 ? ids[0] : ids,
      source: 'fallback',
      warning: 'dog.ceo unreachable',
    });
  }
}

/* GET /api/dog/random */
router.get('/random', (req, res) => {
  const n = Math.min(Math.max(parseInt(req.query.count, 10) || 1, 1), 10);
  const path = n === 1 ? '/breeds/image/random' : `/breeds/image/random/${n}`;
  return respond(req, res, path, n);
});

/* GET /api/dog/list */
router.get('/list', (req, res) => respond(req, res, '/breeds/list/all', 1));

/* GET /api/dog/breed/:breed(/:sub) */
router.get('/breed/:breed/:sub?', (req, res) => {
  const { breed, sub } = req.params;
  if (!ok(breed) || (sub && !ok(sub))) {
    return res.status(422).json({ error: 'VALIDATION', message: 'Unsupported breed name.' });
  }
  const path = sub ? `/breed/${breed}/${sub}/images/random` : `/breed/${breed}/images/random`;
  return respond(req, res, path, 1);
});

module.exports = router;
