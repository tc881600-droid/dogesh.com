'use strict';
/**
 * Seeds the SQLite database:
 *   1. facts + featured breeds + fallback breeds (static content)
 *   2. the full breed index pulled from dog.ceo (network optional)
 *   3. a demo user so you can log in immediately
 *
 * Safe to run repeatedly (idempotent upserts).
 */
const { db, tables } = require("./db");
const { FALLBACK_BREEDS, FEATURED_BREEDS, FACTS } = require('./data');
const bcrypt = require('bcryptjs');

const API = process.env.DOG_API || 'https://dog.ceo/api';

const cap = (s) =>
  String(s).replace(/-/g, ' ').split(' ').filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const { NAME_OVERRIDES } = require('./data');

function buildEntries(map) {
  const entries = [];
  for (const [key, subs] of Object.entries(map)) {
    if (!subs.length) {
      entries.push({
        id: key, name: NAME_OVERRIDES[key] || cap(key), groupKey: key, variant: '',
        endpoint: `${API}/breed/${key}/images/random`,
      });
    } else {
      for (const sub of subs) {
        const id = `${key}-${sub}`;
        entries.push({
          id, name: NAME_OVERRIDES[id] || `${cap(sub)} ${cap(key)}`, groupKey: key, variant: sub,
          endpoint: `${API}/breed/${key}/${sub}/images/random`,
        });
      }
    }
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchAllBreeds() {
  const res = await fetch(`${API}/breeds/list/all`, { signal: AbortSignal.timeout(15000) });
  const json = await res.json();
  if (json.status !== 'success') throw new Error('unexpected payload');
  return buildEntries(json.message);
}

async function main() {
  /* ---- facts ---- */
  tables.facts.clear.run();
  FACTS.forEach((f) => tables.facts.insert.run(f));
  console.log(`facts: ${FACTS.length}`);

  /* ---- static rows first so the DB is never empty ---- */
  const insertMany = db.transaction((rows) => {
    let n = 0;
    for (const r of rows) {
      tables.breeds.insert.run({
        id: r.id, name: r.name, group_key: r.groupKey ?? '', variant: r.variant ?? '',
        endpoint: r.endpoint ?? null, blurb: r.blurb ?? '', badge: r.badge ?? '',
        featured: r.featured ? 1 : 0, sort_order: r.sort_order ?? 0,
      });
      n++;
    }
    return n;
  });

  insertMany(FEATURED_BREEDS.map((b, i) => ({ ...b, groupKey: b.id.split('-')[0], variant: b.id.split('-')[1] || '', featured: 1, sort_order: i + 1 })));
  insertMany(FALLBACK_BREEDS.map(([name, n]) => ({ id: `fb-${n}`, name, groupKey: '', variant: '', endpoint: null, sort_order: 900 + n })));
  console.log(`featured: ${FEATURED_BREEDS.length}, fallback: ${FALLBACK_BREEDS.length}`);

  /* ---- full index from dog.ceo ---- */
  try {
    const entries = await fetchAllBreeds();
    insertMany(entries.map((e, i) => ({ ...e, sort_order: i + 1 })));
    tables.meta.set.run('breeds_source', 'dog.ceo');
    console.log(`breeds synced from dog.ceo: ${entries.length}`);
  } catch (err) {
    tables.meta.set.run('breeds_source', 'offline');
    console.warn(`dog.ceo unreachable (${err.message}) — kept static rows only`);
  }

  /* ---- demo account ---- */
  const email = 'demo@dogesh.com';
  if (!tables.users.byEmail.get(email)) {
    tables.users.create.run({
      email, full_name: 'Demo Dog Person',
      password_hash: bcrypt.hashSync(process.env.DEMO_PASSWORD || 'gooddog123', 10),
    });
    console.log(`created demo user ${email} / ${process.env.DEMO_PASSWORD || 'gooddog123'}`);
  } else {
    console.log(`demo user already exists`);
  }

  console.log(`total breeds in DB: ${tables.breeds.count.get().n}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
