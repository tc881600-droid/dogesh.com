'use strict';
/**
 * Static content that used to live inline in index.html, now served from the API.
 */

/* Name overrides where sub + base reads wrong (ported 1:1 from the original page) */
const NAME_OVERRIDES = {
  'german-shepherd': 'German Shepherd', 'finnish-lapphund': 'Finnish Lapphund',
  'danish-swedish-farmdog': 'Danish Swedish Farmdog', 'african-wild': 'African Wild Dog',
  'rough-collie': 'Rough Collie', 'australian-kelpie': 'Australian Kelpie',
  'australian-shepherd': 'Australian Shepherd', 'australian-cattledog': 'Australian Cattle Dog',
  'labrador': 'Labrador Retriever', 'mix': 'Just A Mix (10/10)',
  'cotondetulear': 'Coton de Tuléar', 'sharpei': 'Shar Pei', 'shihtzu': 'Shih Tzu',
  'stbernard': 'Saint Bernard', 'pitbull': 'Pit Bull', 'mexicanhairless': 'Mexican Hairless Dog',
  'xolo': 'Xoloitzcuintli',
};

/* Offline fallback list (the page never looks dead) */
const FALLBACK_BREEDS = [
  ['Golden Retriever', 1], ['Pug', 2], ['Husky', 3], ['Dachshund', 4], ['Beagle', 5], ['Corgi', 6],
  ['Dalmatian', 7], ['Boxer', 8], ['Poodle', 9], ['Shiba Inu', 10], ['Great Dane', 11], ['Rottweiler', 12],
  ['Border Collie', 13], ['Samoyed', 14], ['Akita', 15], ['Whippet', 16],
];

/* Hall of Fame — Section 02 */
const FEATURED_BREEDS = [
  { id: 'retriever-golden', name: 'Golden Retriever', endpoint: 'https://dog.ceo/api/breed/retriever/golden/images/random', badge: '10/10', blurb: 'Professional ball enthusiast. Will trade you a sock for your entire heart.' },
  { id: 'bulldog-french',   name: 'French Bulldog',    endpoint: 'https://dog.ceo/api/breed/bulldog/french/images/random',   badge: 'Snore pro', blurb: 'Bat ears, zero thoughts. Snores in three octaves and owns the place.' },
  { id: 'husky',            name: 'Siberian Husky',    endpoint: 'https://dog.ceo/api/breed/husky/images/random',             badge: 'Drama', blurb: 'Contains one (1) dramatic opinion at all times. Runs marathons for fun.' },
  { id: 'dachshund',        name: 'Dachshund',         endpoint: 'https://dog.ceo/api/breed/dachshund/images/random',         badge: 'Long boi', blurb: 'A hot dog with a hunter’s heart. Burrows into blankets and other people’s business.' },
  { id: 'dane-great',       name: 'Great Dane',        endpoint: 'https://dog.ceo/api/breed/dane/great/images/random',        badge: 'Gentle giant', blurb: 'Apartment-sized lap dog. Unaware of its own size. Gentle as a rumor.' },
  { id: 'hound-afghan',     name: 'Afghan Hound',      endpoint: 'https://dog.ceo/api/breed/hound/afghan/images/random',      badge: 'Supermodel', blurb: 'Arrives late, looks expensive, leaves immediately. The supermodel of dogs.' },
];

/* Loud Facts — Section 03 */
const FACTS = [
  { stat: '10K+', unit: '', label: 'Years', body: 'of sitting next to humans and being good. Longest friendship streak ever.', rot: '' },
  { stat: '300M', unit: '', label: 'Scent receptors', body: "in a dog nose. Humans get 6 million. We're not even close. It's embarrassing.", rot: 'rotate-1' },
  { stat: '45', unit: 'KM/H', label: 'Greyhound top speed', body: 'Faster than your Wi-Fi on a bad day. The couch potato variant also exists.', rot: '-rotate-1' },
  { stat: '1', unit: '', label: 'Unique nose print', body: 'Every dog nose is one of one, like a fingerprint. Boop responsibly.', rot: '' },
];

/* Marquee ticker lines */
const TICKER = [
  'Woof woof', 'Good dogs only', "Adopt don't shop", 'Hard shadows', 'Zero blur',
  'Sniff first, ask later', '10/10', 'Bork bork bork', 'Treats are currency', 'Zoomies at 3am',
];

const VERDICTS = [
  '10/10 would pet', 'Certified good boy', 'Certified good girl', 'Smells like grass, 10/10',
  'Professional ball enthusiast', 'Looks expensive. Is not.', 'Would share snacks with',
];

module.exports = { NAME_OVERRIDES, FALLBACK_BREEDS, FEATURED_BREEDS, FACTS, TICKER, VERDICTS };
