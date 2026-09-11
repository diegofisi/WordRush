// Builds backend/src/modules/words/data/{es,en}.json from public word lists.
// Sources (downloaded next to this script):
//   words_alpha.txt        dwyl/english-words (Unlicense)          -> English dictionary (allowed guesses)
//   popular.txt            dolph/dictionary (common words, no names) -> English answers
//   es_words_loren.txt     lorenbrichter/Words es                  -> Spanish dictionary with conjugations (allowed guesses)
//   es_lemario.txt         olea/lemarios                           -> Spanish headwords (answers prefer these)
//   first-names.txt        dominictarr/random-name + hadley/data-baby-names -> names to exclude from answers
//   google-10000.txt       first20hours/google-10000-english       -> used to spot English words in the Spanish corpus
//   en_full.txt, es_full.txt, es_50k.txt  hermitdave/FrequencyWords (CC-BY-SA 4.0) -> frequency
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const out = process.argv[2];
if (!out) throw new Error('usage: node build-words.mjs <output dir>');
mkdirSync(out, { recursive: true });

const read = (f) => readFileSync(path.join(here, f), 'utf8').split(/\r?\n/);
const freq = (f) => {
  const m = new Map();
  for (const line of read(f)) {
    const [w, c] = line.trim().split(/\s+/);
    if (w && c) m.set(w, Number(c));
  }
  return m;
};

// Words nobody should be asked to guess or allowed to throw at others.
const BLOCK = new Set([
  'nigga', 'nigger', 'spick', 'kikes', 'gooks', 'dykes', 'fagot', 'faggy', 'chink', 'wetback',
  'negro', 'negra', 'putas', 'putos', 'maric', 'sudac', 'polla', 'pollas', 'verga', 'coños', 'mierd',
  'pinga', 'puton', 'himen', 'chota', 'culos', 'tetas', 'cabro', 'bolas', 'zorra', 'boner', 'kinky', 'panty',
]);

// Valid words that must never be the answer: explicit terms and proper nouns
// (still accepted as guesses, except the BLOCK list above).
const ANSWER_EXCLUDE = new Set([
  'honda', 'mecca', 'yahoo', 'weber', 'thong', 'bimbo', 'harem', 'girly', 'flack', 'bossy', 'fussy', 'deuce', 'pious', 'teeny', 'sassy', 'drool', 'leech', 'jerky',
  'joder', 'porno', 'nazis', 'penes', 'pedos', 'semen', 'satan', 'utero', 'vulva', 'tanga', 'culon', 'meado', 'judas', 'andes',
  'gales', 'vegas', 'tesla', 'nobel', 'morse', 'coran', 'alamo', 'danes', 'belga', 'turco', 'irani', 'mayas', 'chino', 'checo',
  'sordo', 'polis', 'liras', 'hitler', 'jesus', 'cristo', 'ringo', 'porro', 'bledo', 'persa', 'vasco', 'perra', 'golfa', 'cagar',
  'cague', 'mamon', 'orina', 'pezon', 'orgia', 'chupa', 'chupo', 'chupe', 'maton', 'patan', 'necio', 'torpe', 'gorda', 'gordo',
  'flaco', 'calvo', 'enano', 'zombi', 'arpia', 'vello', 'muslo', 'tripa', 'ingle', 'ebrio', 'abuso', 'acoso', 'rehen', 'judio',
  'judia', 'arabe', 'rusia', 'corea', 'marte', 'neron', 'alpes', 'mingo', 'sueco', 'turca', 'checa', 'indio', 'celda', 'misil',
  'fusil', 'muera', 'ataud', 'horca', 'hedor', 'mugre', 'vison', 'pulga', 'horda', 'purga', 'bruta', 'bruto', 'parto', 'parir',
  'cerda', 'bicho', 'gnomo', 'salio', 'vendi', 'salga', 'queda', 'busca', 'grita', 'quita', 'corra', 'probo', 'moran', 'sufra',
  'falte', 'duela', 'flote', 'borro', 'doblo', 'calmo', 'fundo', 'ladra', 'silba', 'acuse', 'clava', 'tardo', 'monto', 'falto',
  'canso', 'pateo', 'goteo', 'bateo', 'pegue', 'saque', 'acabe', 'podre', 'verme', 'lleve', 'entro', 'haras', 'leido', 'usado',
  'caido', 'hecha', 'trata', 'lleva', 'canta', 'salve', 'cruza', 'choca', 'porta', 'rodea', 'monta', 'cante', 'sobra', 'cuida',
  'venia', 'tenia', 'acabo', 'quedo', 'ahogo', 'apuro', 'movil', 'vater', 'tarta', 'lejia', 'grifo', 'esqui', 'pillo', 'pilla',
  'cursi', 'bollo', 'profe', 'caray', 'hurra', 'voila', 'nomas', 'coñac', 'jerez', 'sidra', 'pudin', 'budin', 'atico', 'anden',
  'jaleo', 'follo', 'curro', 'sueno', 'banjo', 'mutua', 'epica', 'etica', 'vasto', 'sabre', 'apenas', 'busco', 'pongo', 'quemo',
  'niego', 'andas', 'traga', 'rinde', 'aloja', 'suiza', 'apolo', 'roque', 'pelis', 'morro', 'alijo', 'mitin', 'lloro', 'vendo',
  'luche', 'ruego', 'jodio', 'siria', 'suizo', 'sirio', 'ruso', 'rusos', 'rusas', 'chile', 'china', 'cuba', 'peru', 'japon',
  'roma', 'paris', 'bitch', 'whore', 'pussy', 'raped', 'penis', 'boobs', 'fucks', 'dicks', 'shits', 'moron', 'farts', 'crotch',
  'swiss', 'dutch', 'irish', 'texas', 'roman', 'allah', 'bacon', 'euros', 'pesos', 'hindi', 'tamil', 'malay', 'aloha', 'chico',
  'amigo', 'shiva', 'turks', 'lynch', 'vicar', 'thine', 'goons', 'takin', 'bates', 'trump', 'golly', 'ducky', 'piggy', 'psych',
  'steed', 'logan', 'colin', 'daisy', 'monte', 'condo', 'prick', 'horny', 'sperm', 'booty', 'fatty', 'fatso', 'urine', 'vomit',
  'swine', 'slave', 'queer', 'paddy', 'abuse', 'tramp', 'opium', 'booze', 'bleep', 'screw', 'idiot', 'filth', 'crook', 'arson',
  'manic', 'bloke', 'howdy', 'gimme', 'kiddo', 'ahold', 'legit', 'scram', 'fella', 'sarge', 'shush', 'whoop', 'gabby', 'hubby',
  'momma', 'mamma', 'mummy', 'cutie', 'shalt', 'yummy', 'comfy', 'cocky', 'whack', 'snuck', 'doggy', 'dandy', 'bogus', 'phony',
  'funky', 'fishy', 'stink', 'lousy', 'nasty', 'freak', 'dummy', 'pinky', 'tummy', 'macho', 'senor', 'padre', 'bible', 'costa',
  'stein', 'hogan', 'chang', 'rabbi', 'titan', 'omega', 'gamma', 'derby', 'ninja', 'vodka', 'sushi', 'pizza', 'salsa', 'pasta',
  'tango', 'rodeo', 'bingo', 'bravo', 'mafia', 'disco', 'opera', 'curry', 'chili', 'cocoa', 'cigar', 'medic', 'known', 'given',
  'taken', 'meant', 'spent', 'wrote', 'drove', 'chose', 'stood', 'threw', 'slept', 'spoke', 'broke', 'stole', 'built', 'began',
  'begun', 'drank', 'blown', 'grown', 'drawn', 'sworn', 'swore', 'swept', 'shook', 'froze', 'flown', 'woken', 'risen', 'shown',
  'eaten', 'dealt', 'cried', 'fried', 'burnt', 'stuck', 'found', 'heard', 'worse', 'worst', 'spelt', 'shone', 'slain', 'stung',
  'swung', 'flung', 'clung', 'strung', 'wound', 'bound', 'going', 'doing', 'being', 'lying', 'using', 'dying', 'tying', 'suing',
  'women', 'teeth', 'boxes', 'taxes', 'ashes', 'buses', 'those', 'these', 'older', 'lower', 'safer', 'nicer', 'wider', 'wiser',
  'fewer', 'newly', 'madly', 'sadly', 'badly', 'fully', 'truly', 'gotta', 'gonna', 'wanna', 'kinda', 'lotta', 'yanks', 'brits',
  'greek', 'japan', 'spain', 'cuban', 'asian', 'welsh', 'dobla', 'corro', 'quejo', 'quito', 'quite', 'salva', 'torna', 'apure',
  'ligue', 'meneo', 'frote', 'rallo', 'rento', 'agote', 'anulo', 'jadeo', 'asomo', 'tumbo', 'trepa', 'cateo', 'zumba', 'lazar',
  'peina', 'coito', 'ovulo', 'meada', 'cagon', 'picha', 'ojete', 'mojon', 'nalga', 'fecal', 'bosta', 'chavo', 'cholo', 'macon',
  'merca', 'muñon', 'zurra', 'labia', 'mamar', 'haren', 'vichy', 'curie', 'greco', 'celta', 'sajon', 'babel', 'tulio', 'argon',
  'boson', 'lumen', 'virgo', 'lupus', 'edema', 'enema', 'lepra', 'polio', 'sarna', 'apnea', 'miope', 'bizco', 'manco', 'obeso',
  'paria', 'plebe', 'impio', 'iluso', 'esnob', 'dandi', 'bocon', 'fiero', 'viril', 'pudor', 'pecar', 'credo', 'clero', 'salmo',
  'sacro', 'papal', 'tarot', 'ninfa', 'visir', 'mirza', 'pater', 'bonzo', 'lamia', 'abate', 'meson', 'facha', 'argot', 'fogon',
  'rocha', 'pacha', 'morra', 'peque', 'tacho', 'bolin', 'chapo', 'chale', 'cuate', 'hucha', 'gacha', 'petar', 'guita', 'ruedo',
  'lando', 'fardo', 'fusta', 'bozal', 'veraz', 'chita', 'omiso', 'ardid', 'betun', 'nafta', 'cinto', 'carpe', 'reten', 'perno',
  'sedal', 'redil', 'ajuar', 'amaro', 'añada', 'vivaz', 'voraz', 'sarta', 'posta', 'apice', 'pompa', 'rimel', 'cacho', 'caqui',
  'creta', 'zafar', 'apaño', 'aviar', 'hache', 'gamba', 'ojiva', 'conga', 'bardo', 'bidon', 'magno', 'zebra', 'yacer', 'dogma',
  'bagre', 'alado', 'facto', 'minar', 'futon', 'arcon', 'basar', 'añejo', 'recio', 'feudo', 'timar', 'flama', 'gaita', 'tapia',
  'avido', 'crepe', 'aster', 'regio', 'patin', 'tonel', 'filon', 'cuajo', 'chute', 'rotar', 'nadir', 'reuma', 'tacha', 'ebano',
  'lauda', 'craso', 'rotor', 'cauto', 'tunda', 'taiga', 'burdo', 'rayon', 'legua', 'atrio', 'hidra', 'yelmo', 'rimar', 'futil',
  'mirra', 'cabal', 'acebo', 'trufa', 'bongo', 'dueto', 'calza', 'bemol', 'liceo', 'virar', 'chato', 'mondo', 'corso', 'hampa',
  'tosco', 'nitro', 'saten', 'logia', 'banal', 'boxer', 'totem', 'batea', 'braga', 'bajon', 'drago', 'pujar', 'yarda', 'fetal',
  'arduo', 'vigia', 'pardo', 'idear', 'garbo', 'tenor', 'llano', 'valet', 'morsa', 'tempo', 'tifon', 'snoop', 'oddly', 'chump',
  'posse', 'jumbo', 'recon', 'gavel', 'homey', 'serge', 'cupid', 'abbot', 'spank', 'geese', 'hallo', 'sahib', 'gases', 'wench',
  'youse', 'tacky', 'hydra', 'scoot', 'loony', 'caste', 'kappa', 'pagan', 'pager', 'gator', 'triad', 'booby', 'buggy', 'finer',
  'chevy', 'bowel', 'felon', 'pushy', 'dodgy', 'wacky', 'fetus', 'eater', 'rowdy', 'snuff', 'lefty', 'potty', 'spook', 'griff',
  'goofy', 'goody', 'noose', 'slime', 'aging', 'fudge', 'stomp', 'whiff', 'giddy', 'biker', 'juror', 'brawl', 'swipe', 'roach',
  'stoop', 'crave', 'whine', 'lowly', 'cramp', 'stump', 'purge', 'fiend', 'peril', 'elope', 'sling', 'bumpy', 'bleak', 'expel',
  'mound', 'unfit', 'timid', 'stalk', 'swarm', 'boast', 'snore', 'farce', 'folly', 'smear', 'hutch', 'knack', 'chord', 'furry',
  'chimp', 'combo', 'pouch', 'chime', 'loner', 'broth', 'plank', 'latch', 'rinse', 'cello', 'civic', 'vista', 'ultra', 'sedan',
  'torso',
]);

// Spain-only slang or regionally loaded words: never an answer (neutral Spanish).
const SPAIN_ONLY = new Set([
  'bledo', 'porro', 'curro', 'chulo', 'chula', 'cutre', 'pijos', 'pijas', 'birra', 'jolin', 'ostia', 'flipa',
  'molar', 'guays', 'majos', 'majas', 'chorra', 'chorbo', 'coger', 'cojas', 'cojan', 'cojon', 'gilis', 'pasma',
  'canis', 'yonki', 'guiri', 'gañan', 'chachi', 'follar', 'folla', 'pavos', 'tronco', 'mazos', 'pringa',
]);

// First names show up lowercased in subtitle corpora; never use them as answers.
const NAMES = new Set(read('first-names.txt').map((w) => w.trim().toLowerCase()).filter(Boolean));

const normEs = (w) =>
  w
    .toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');

// ---------- English ----------
{
  const dict = new Set(read('words_alpha.txt').map((w) => w.trim()).filter((w) => /^[a-z]{5}$/.test(w)));
  const enFull = freq('en_full.txt');
  const common = read('google-10000.txt').map((w) => w.trim()).filter((w) => /^[a-z]{5}$/.test(w));

  // Answers: dictionary words ranked by how often they appear in real text, most
  // common first (the picker favours the head of the list). Names and slurs out.
  // dolph/dictionary popular.txt: ~25k common English words, no proper nouns.
  const popular = new Set(read('popular.txt').map((w) => w.trim()).filter((w) => /^[a-z]{5}$/.test(w)));
  const dict4 = new Set(read('words_alpha.txt').map((w) => w.trim()).filter((w) => /^[a-z]{3,4}$/.test(w)));
  const isPlural = (w) => w.endsWith('s') && !w.endsWith('ss') && (dict4.has(w.slice(0, -1)) || (w.endsWith('ies') && dict4.has(w.slice(0, -3) + 'y')));
  const isPast = (w) => w.endsWith('ed') && (dict4.has(w.slice(0, -2)) || dict4.has(w.slice(0, -1)));
  const EN_ANSWERS = Number(process.env.EN_ANSWERS ?? 898);
  const answers = [...popular]
    .filter((w) => dict.has(w) && (enFull.get(w) ?? 0) >= 40 && !BLOCK.has(w) && !NAMES.has(w) && !ANSWER_EXCLUDE.has(w))
    .filter((w) => !isPlural(w) && !isPast(w))
    .sort((a, b) => (enFull.get(b) ?? 0) - (enFull.get(a) ?? 0))
    .slice(0, EN_ANSWERS);
  console.log('en tail:', answers.slice(-12).join(' '));

  // Allowed: English dictionary words seen in real English text (drops fossils and
  // the few foreign words the dictionary carries), plus every answer.
  const allowedSet = new Set(answers);
  for (const w of dict) if ((enFull.get(w) ?? 0) >= 3 && !BLOCK.has(w)) allowedSet.add(w);
  const allowed = [...allowedSet].sort();

  writeFileSync(path.join(out, 'en.json'), JSON.stringify({ language: 'en', answers, allowed }));
  console.log(`en: ${answers.length} answers, ${allowed.length} allowed`);
}

// ---------- Spanish ----------
{
  const es50 = freq('es_50k.txt');
  const esFull = freq('es_full.txt');

  // Merge accent variants under their normalised form (limón + limon -> limon).
  const fullNorm = new Map();
  for (const [w, c] of esFull) {
    if (!/^[a-záéíóúüñ]+$/.test(w)) continue;
    const n = normEs(w);
    if (n.length !== 5) continue;
    fullNorm.set(n, (fullNorm.get(n) ?? 0) + c);
  }
  const rankNorm = new Map();
  let rank = 0;
  for (const [w] of es50) {
    if (!/^[a-záéíóúüñ]+$/.test(w)) continue;
    const n = normEs(w);
    if (n.length !== 5) continue;
    if (!rankNorm.has(n)) rankNorm.set(n, rank++);
  }

  // Subtitle corpora carry English words and names; require a healthy count and
  // drop anything that is also a very common English word but rare as Spanish.
  // Spanish dictionary with conjugations, already accent-free (lorenbrichter/Words).
  const esDict = new Set(
    read('es_words_loren.txt').map((w) => normEs(w.trim())).filter((w) => /^[a-zñ]{5}$/.test(w)),
  );
  const enCommon = new Set(read('google-10000.txt').map((w) => w.trim()));
  // olea/lemarios: dictionary headwords. Answers are BASE FORMS ONLY (infinitives,
  // singular nouns, masculine singular adjectives): no conjugations, no plurals.
  // That also removes every vosotros form, the most Spain-specific grammar.
  const lemario = new Set(read('es_lemario.txt').map((w) => normEs(w.trim())).filter((w) => /^[a-zñ]{5}$/.test(w)));
  // michmech/lemmatization-lists (lemma<TAB>form): a word counts as a base form only if
  // it is a LEMMA there too. The lemario alone lists many conjugations as entries.
  const lemmas = new Set();
  for (const line of read('lemmatization-es.txt')) {
    const [lemma] = line.replace(/^﻿/, '').split('	');
    if (lemma) lemmas.add(normEs(lemma.trim()));
  }
  const ES_ANSWERS = Number(process.env.ES_ANSWERS ?? 870);
  const ES_LEMMA_MIN = Number(process.env.ES_LEMMA_MIN ?? 40);
  const answers = [...lemario]
    .filter((w) => esDict.has(w) && lemmas.has(w) && (fullNorm.get(w) ?? 0) >= ES_LEMMA_MIN)
    .filter((w) => !BLOCK.has(w) && !NAMES.has(w) && !ANSWER_EXCLUDE.has(w) && !SPAIN_ONLY.has(w))
    .filter((w) => !(enCommon.has(w) && (fullNorm.get(w) ?? 0) < 5000))
    .sort((a, b) => (fullNorm.get(b) ?? 0) - (fullNorm.get(a) ?? 0))
    .slice(0, ES_ANSWERS);
  console.log('es tail:', answers.slice(-12).join(' '));

  // Allowed: dictionary words only. The subtitle corpus is NOT used here: it is
  // full of English words (cloud, party...) that must not count as Spanish.
  const allowedSet = new Set(answers);
  for (const w of esDict) if (!BLOCK.has(w)) allowedSet.add(w);
  const allowed = [...allowedSet].sort();

  writeFileSync(path.join(out, 'es.json'), JSON.stringify({ language: 'es', answers, allowed }));
  console.log(`es: ${answers.length} answers, ${allowed.length} allowed`);
}
