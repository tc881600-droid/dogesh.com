'use strict';
/**
 * Breed catalogue endpoints — the page used to fetch dog.ceo straight from the browser.
 * Now everything is served from SQLite, with images proxied through /api/dog/*.
 */
const express = require('express');
const { tables, publicBreed } = require('../db');
const { authenticate } = require('../auth');
const { VERDICTS } = require('../data');

const router = express.Router();

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 96;

const ratingMap = () => new Map(tables.ratings.stats.all().map((r) => [r.breed_id, r]));

function decorate(rows, userId) {
  const stats = ratingMap();
  const favs = userId
    ? new Set(tables.favorites.idsForUser.all(userId).map((r) => r.breed_id))
    : new Set();

  return rows.map((row) => {
    const s = stats.get(row.id) || { votes: 0, average: null };
    return publicBreed(row, {
      votes: s.votes,
      average: s.average,
      favorites: row.favorites_count,
      favorite: favs.has(row.id),
      verdict: VERDICTS[row.name.length % VERDICTS.length],
    });
  });
}

/* GET /api/breeds?search=&limit=&offset= */
router.get('/', authenticate(), (req, res) => {
  const q = String(req.query.search || '').trim().slice(0, 60);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  let rows, total;
  if (q) {
    rows = tables.breeds.search.all({ q, limit, offset });
    total = tables.breeds.searchCount.get({ q }).n;
  } else {
    const all = tables.breeds.all.all();
    rows = all.slice(offset, offset + limit);
    total = all.length;
  }

  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    data: decorate(rows, req.user && req.user.id),
    meta: { total, limit, offset, hasMore: offset + rows.length < total, search: q },
  });
});

/* GET /api/breeds/featured — Hall of Fame */
router.get('/featured', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ data: decorate(tables.breeds.featured.all(), null) });
});

/* GET /api/breeds/favorites — current user's pack */
router.get('/favorites', authenticate({ required: true }), (req, res) => {
  res.json({ data: decorate(tables.favorites.listForUser.all(req.user.id), req.user.id) });
});

/* GET /api/breeds/:id */
router.get('/:id', authenticate(), (req, res) => {
  const row = tables.breeds.byId.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'No such dog in the archive.' });

  const s = tables.ratings.forBreed.get(row.id);
  res.json({
    data: publicBreed(row, {
      votes: s.votes,
      average: s.average,
      favorites: row.favorites_count,
      favorite: req.user ? !!tables.favorites.has.get(req.user.id, row.id) : false,
      verdict: VERDICTS[row.name.length % VERDICTS.length],
    }),
  });
});

/* POST /api/breeds/:id/rate  { score: 1..10 } */
router.post('/:id/rate', authenticate({ required: true }), (req, res) => {
  const row = tables.breeds.byId.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'No such dog in the archive.' });

  const score = parseInt((req.body || {}).score, 10);
  if (!(score >= 1 && score <= 10)) {
    return res.status(422).json({ error: 'VALIDATION', message: 'Score must be between 1 and 10.' });
  }
  tables.ratings.add.run(row.id, score);
  const s = tables.ratings.forBreed.get(row.id);
  res.json({ data: { id: row.id, votes: s.votes, average: s.average }, message: `Rated ${row.name} ${score}/10.` });
});

/* POST /api/breeds/:id/favorite — toggle membership in the user's pack */
router.post('/:id/favorite', authenticate({ required: true }), (req, res) => {
  const row = tables.breeds.byId.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'NOT_FOUND', message: 'No such dog in the archive.' });

  if (tables.favorites.has.get(req.user.id, row.id)) {
    tables.favorites.remove.run(req.user.id, row.id);
    tables.favorites.bumpBreed.run(-1, row.id);
    return res.json({ data: { id: row.id, favorite: false }, message: `Removed ${row.name} from your pack.` });
  }
  tables.favorites.add.run({ user_id: req.user.id, breed_id: row.id });
  tables.favorites.bumpBreed.run(1, row.id);
  res.status(201).json({ data: { id: row.id, favorite: true }, message: `${row.name} joined your pack.` });
});

module.exports = router;
