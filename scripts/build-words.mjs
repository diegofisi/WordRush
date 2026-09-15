// Builds backend/src/modules/words/data/{es,en}{,6,7}.json from public word lists:
// one file per language and word length (5 has no suffix; 6 and 7 do).
// Sources (downloaded into scripts/sources/, not committed):
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

const sources = path.join(here, 'sources');
const read = (f) => readFileSync(path.join(sources, f), 'utf8').split(/\r?\n/);
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
  'nigga', 'nigger', 'faggot', 'spick', 'kikes', 'gooks', 'dykes', 'fagot', 'faggy', 'chink', 'wetback', 'maric', 'sudac',
]);

// Valid words that must never be the answer: explicit terms and proper nouns
// (still accepted as guesses, except the BLOCK list above).
const ANSWER_EXCLUDE = new Set([
  'mecca', 'yahoo', 'weber', 'thong', 'bimbo', 'harem', 'girly', 'flack', 'bossy', 'fussy', 'deuce', 'pious', 'teeny', 'sassy',
  'drool', 'leech', 'jerky', 'joder', 'porno', 'nazis', 'penes', 'pedos', 'semen', 'satan', 'utero', 'vulva', 'tanga', 'culon',
  'meado', 'judas', 'andes', 'gales', 'vegas', 'tesla', 'nobel', 'morse', 'coran', 'alamo', 'irani', 'mayas', 'polis', 'liras',
  'hitler', 'jesus', 'cristo', 'ringo', 'porro', 'bledo', 'perra', 'golfa', 'cagar', 'cague', 'mamon', 'orina', 'pezon', 'orgia',
  'chupa', 'chupo', 'chupe', 'maton', 'patan', 'arpia', 'abuso', 'acoso', 'judio', 'judia', 'rusia', 'corea', 'marte', 'neron',
  'alpes', 'mingo', 'indio', 'muera', 'horda', 'salio', 'vendi', 'salga', 'queda', 'busca', 'grita', 'quita', 'corra', 'probo',
  'moran', 'sufra', 'falte', 'duela', 'flote', 'borro', 'doblo', 'calmo', 'fundo', 'ladra', 'silba', 'acuse', 'clava', 'tardo',
  'monto', 'falto', 'canso', 'pateo', 'goteo', 'bateo', 'pegue', 'saque', 'acabe', 'podre', 'verme', 'lleve', 'entro', 'haras',
  'leido', 'usado', 'caido', 'hecha', 'trata', 'lleva', 'canta', 'salve', 'cruza', 'choca', 'porta', 'rodea', 'monta', 'cante',
  'sobra', 'cuida', 'venia', 'tenia', 'acabo', 'quedo', 'ahogo', 'vater', 'tarta', 'lejia', 'grifo', 'pilla', 'bollo', 'profe',
  'caray', 'hurra', 'voila', 'nomas', 'jerez', 'jaleo', 'follo', 'curro', 'sueno', 'sabre', 'apenas', 'busco', 'pongo', 'quemo',
  'niego', 'andas', 'traga', 'rinde', 'aloja', 'apolo', 'roque', 'pelis', 'morro', 'alijo', 'mitin', 'lloro', 'vendo', 'luche',
  'ruego', 'jodio', 'siria', 'ruso', 'rusos', 'rusas', 'chile', 'china', 'cuba', 'peru', 'japon', 'roma', 'paris', 'bitch',
  'whore', 'pussy', 'raped', 'penis', 'boobs', 'fucks', 'dicks', 'shits', 'moron', 'farts', 'crotch', 'swiss', 'dutch', 'irish',
  'texas', 'roman', 'allah', 'bacon', 'euros', 'pesos', 'hindi', 'tamil', 'malay', 'aloha', 'shiva', 'turks', 'lynch', 'vicar',
  'thine', 'goons', 'takin', 'bates', 'trump', 'golly', 'ducky', 'piggy', 'psych', 'steed', 'logan', 'colin', 'daisy', 'monte',
  'condo', 'prick', 'horny', 'sperm', 'booty', 'fatty', 'fatso', 'urine', 'vomit', 'swine', 'slave', 'queer', 'paddy', 'abuse',
  'tramp', 'opium', 'booze', 'bleep', 'screw', 'idiot', 'filth', 'crook', 'arson', 'manic', 'bloke', 'howdy', 'gimme', 'kiddo',
  'ahold', 'legit', 'scram', 'fella', 'sarge', 'shush', 'whoop', 'gabby', 'hubby', 'momma', 'mamma', 'mummy', 'cutie', 'shalt',
  'yummy', 'comfy', 'cocky', 'whack', 'snuck', 'doggy', 'dandy', 'bogus', 'phony', 'funky', 'fishy', 'stink', 'lousy', 'nasty',
  'freak', 'dummy', 'pinky', 'tummy', 'bible', 'stein', 'hogan', 'chang', 'rabbi', 'omega', 'gamma', 'derby', 'chili', 'cocoa',
  'cigar', 'medic', 'known', 'given', 'taken', 'meant', 'spent', 'wrote', 'drove', 'chose', 'stood', 'threw', 'slept', 'spoke',
  'broke', 'stole', 'built', 'began', 'begun', 'drank', 'blown', 'grown', 'drawn', 'sworn', 'swore', 'swept', 'shook', 'froze',
  'flown', 'woken', 'risen', 'shown', 'eaten', 'dealt', 'cried', 'fried', 'burnt', 'stuck', 'found', 'heard', 'worse', 'worst',
  'spelt', 'shone', 'slain', 'stung', 'swung', 'flung', 'clung', 'strung', 'wound', 'bound', 'going', 'doing', 'being', 'lying',
  'using', 'dying', 'tying', 'suing', 'women', 'teeth', 'boxes', 'taxes', 'ashes', 'buses', 'those', 'these', 'older', 'lower',
  'safer', 'nicer', 'wider', 'wiser', 'fewer', 'newly', 'madly', 'sadly', 'badly', 'fully', 'truly', 'gotta', 'gonna', 'wanna',
  'kinda', 'lotta', 'yanks', 'brits', 'greek', 'japan', 'spain', 'cuban', 'asian', 'welsh', 'dobla', 'corro', 'quejo', 'quito',
  'quite', 'salva', 'torna', 'apure', 'ligue', 'meneo', 'frote', 'rallo', 'rento', 'agote', 'anulo', 'jadeo', 'asomo', 'tumbo',
  'trepa', 'cateo', 'zumba', 'lazar', 'peina', 'coito', 'ovulo', 'meada', 'cagon', 'picha', 'ojete', 'mojon', 'nalga', 'fecal',
  'bosta', 'chavo', 'cholo', 'macon', 'merca', 'muñon', 'zurra', 'labia', 'mamar', 'haren', 'vichy', 'curie', 'greco', 'celta',
  'sajon', 'babel', 'tulio', 'argon', 'boson', 'lumen', 'virgo', 'lupus', 'edema', 'enema', 'lepra', 'polio', 'sarna', 'apnea',
  'miope', 'bizco', 'manco', 'obeso', 'paria', 'plebe', 'impio', 'iluso', 'esnob', 'dandi', 'bocon', 'fiero', 'viril', 'pudor',
  'pecar', 'credo', 'clero', 'salmo', 'sacro', 'papal', 'tarot', 'ninfa', 'visir', 'mirza', 'pater', 'bonzo', 'lamia', 'abate',
  'meson', 'facha', 'argot', 'fogon', 'rocha', 'pacha', 'morra', 'peque', 'tacho', 'bolin', 'chapo', 'chale', 'cuate', 'hucha',
  'gacha', 'petar', 'guita', 'ruedo', 'lando', 'fardo', 'fusta', 'bozal', 'veraz', 'chita', 'omiso', 'ardid', 'betun', 'nafta',
  'cinto', 'carpe', 'reten', 'perno', 'sedal', 'redil', 'ajuar', 'amaro', 'añada', 'vivaz', 'voraz', 'sarta', 'posta', 'apice',
  'pompa', 'rimel', 'cacho', 'caqui', 'creta', 'zafar', 'apaño', 'aviar', 'hache', 'gamba', 'ojiva', 'conga', 'bardo', 'bidon',
  'magno', 'zebra', 'yacer', 'dogma', 'bagre', 'alado', 'facto', 'minar', 'futon', 'arcon', 'basar', 'añejo', 'recio', 'feudo',
  'timar', 'flama', 'gaita', 'tapia', 'avido', 'crepe', 'aster', 'regio', 'patin', 'tonel', 'filon', 'cuajo', 'chute', 'rotar',
  'nadir', 'reuma', 'tacha', 'ebano', 'lauda', 'craso', 'rotor', 'cauto', 'tunda', 'taiga', 'burdo', 'rayon', 'legua', 'atrio',
  'hidra', 'yelmo', 'rimar', 'futil', 'mirra', 'cabal', 'acebo', 'trufa', 'bongo', 'dueto', 'calza', 'bemol', 'liceo', 'virar',
  'chato', 'mondo', 'corso', 'hampa', 'tosco', 'nitro', 'saten', 'logia', 'banal', 'boxer', 'totem', 'batea', 'braga', 'bajon',
  'drago', 'pujar', 'yarda', 'fetal', 'arduo', 'vigia', 'idear', 'garbo', 'morsa', 'tifon', 'snoop', 'oddly', 'chump', 'posse',
  'jumbo', 'recon', 'gavel', 'homey', 'serge', 'cupid', 'abbot', 'spank', 'geese', 'hallo', 'sahib', 'gases', 'wench', 'youse',
  'tacky', 'hydra', 'scoot', 'loony', 'caste', 'kappa', 'pagan', 'pager', 'gator', 'triad', 'booby', 'buggy', 'finer', 'chevy',
  'bowel', 'felon', 'pushy', 'dodgy', 'wacky', 'fetus', 'eater', 'rowdy', 'snuff', 'lefty', 'potty', 'spook', 'griff', 'goofy',
  'goody', 'noose', 'slime', 'aging', 'fudge', 'stomp', 'whiff', 'giddy', 'biker', 'juror', 'brawl', 'swipe', 'roach', 'stoop',
  'crave', 'whine', 'lowly', 'cramp', 'stump', 'purge', 'fiend', 'peril', 'elope', 'sling', 'bumpy', 'bleak', 'expel', 'mound',
  'unfit', 'timid', 'stalk', 'swarm', 'boast', 'snore', 'farce', 'folly', 'smear', 'hutch', 'knack', 'chord', 'furry', 'chimp',
  'combo', 'pouch', 'chime', 'loner', 'broth', 'plank', 'latch', 'rinse', 'cello', 'civic', 'putas', 'putos', 'polla', 'pollas',
  'verga', 'coños', 'mierd', 'pinga', 'puton', 'himen', 'chota', 'culos', 'tetas', 'cabro', 'bolas', 'zorra', 'boner', 'kinky',
  'panty',
]);

// Spain-only slang or regionally loaded words: never an answer (neutral Spanish).
const SPAIN_ONLY = new Set([
  'bledo', 'porro', 'curro', 'chulo', 'chula', 'cutre', 'pijos', 'pijas', 'birra', 'jolin', 'ostia', 'flipa', 'guays', 'majos',
  'majas', 'chorra', 'chorbo', 'coger', 'cojas', 'cojan', 'cojon', 'gilis', 'pasma', 'canis', 'yonki', 'guiri', 'gañan', 'chachi',
  'follar', 'folla', 'pringa',
]);


// v1.1 (2026-09-15): reviewed by hand while the lists grew to 5/6/7 letters.
// Never an answer, any length: proper nouns, places, nationalities and ethnic
// terms, brands, technical or archaic words, vulgarity, sensitive subjects, and
// conjugated forms and grammar words the lemma filter let through. Still
// allowed as guesses (docs/context/06-v1.1.md).
const ES_EXCLUDE_V11 = new Set([
  'abaco', 'abordo', 'abortar', 'aborto', 'acato', 'acepto', 'ademas', 'agape', 'agora', 'agosto', 'aguar', 'ahogado', 'alabado', 'alabe',
  'albin', 'aleluya', 'aleman', 'alero', 'aleya', 'alguno', 'alquilo', 'amago', 'amante', 'ameba', 'ameno', 'amida', 'amina', 'amorio',
  'anata', 'anglo', 'apagado', 'aparte', 'arcen', 'arreo', 'asear', 'asesinar', 'asesino', 'atril', 'augur', 'autopsia', 'axial', 'ayudado',
  'azufre', 'babeo', 'baden', 'balin', 'balto', 'bamba', 'barda', 'bario', 'batin', 'beato', 'bedel', 'beisbol', 'belen', 'benito',
  'betel', 'biblia', 'billon', 'boche', 'bocio', 'borrado', 'brasil', 'brezo', 'bruno', 'buche', 'bugle', 'bulbo', 'bulla', 'burda',
  'burdel', 'cabello', 'cabron', 'cacha', 'cadaver', 'cafeina', 'cagado', 'calce', 'calcio', 'calzo', 'canalla', 'cancela', 'capon', 'capullo',
  'carajo', 'caramba', 'carbono', 'careo', 'casca', 'castro', 'catar', 'caton', 'ceceo', 'cegar', 'centimo', 'cerrada', 'cerrado', 'cesar',
  'cesio', 'chaco', 'chama', 'champan', 'chaval', 'chepa', 'chicle', 'chito', 'chola', 'chupar', 'cieno', 'ciento', 'cierro', 'cilla',
  'cirio', 'cisma', 'cocaina', 'cocido', 'cofia', 'cogido', 'colada', 'comba', 'comoda', 'concha', 'condado', 'condon', 'contado', 'copla',
  'copon', 'coque', 'coreano', 'corrido', 'cortado', 'cretino', 'crono', 'cruzado', 'cuanto', 'cuarta', 'cubano', 'cubil', 'cuelga', 'curda',
  'curia', 'cuzco', 'dador', 'decima', 'decimo', 'denton', 'desnudo', 'detente', 'diarrea', 'dinar', 'docena', 'domingo', 'dorada', 'dormida',
  'draga', 'druso', 'echado', 'elegido', 'embargo', 'empiece', 'encia', 'enviado', 'escapo', 'esclavo', 'escoces', 'escriba', 'esperma', 'espin',
  'estatal', 'estira', 'etnia', 'europeo', 'falaz', 'farad', 'faraon', 'fatuo', 'fauno', 'febrero', 'federal', 'felpa', 'fermi', 'finta',
  'flema', 'flete', 'flexo', 'folio', 'foque', 'fosforo', 'foton', 'fraga', 'freon', 'fuero', 'fugar', 'fundido', 'futbol', 'gachi',
  'gavia', 'gesta', 'gestapo', 'gibon', 'gitano', 'golpeo', 'grabado', 'grada', 'grajo', 'graso', 'griego', 'grima', 'gringo', 'groso',
  'grupa', 'guano', 'guasa', 'guero', 'guiado', 'guisa', 'habar', 'hafiz', 'halar', 'haute', 'hebreo', 'henry', 'herma', 'horma',
  'hostia', 'idiota', 'imbecil', 'incluso', 'indico', 'infiel', 'ingles', 'inodoro', 'intima', 'istmo', 'italo', 'izada', 'jaleo', 'jalon',
  'jamba', 'japones', 'jerbo', 'jodido', 'julio', 'jurel', 'lacio', 'lacra', 'laico', 'landa', 'laton', 'laude', 'legar', 'leida',
  'lerdo', 'lesbiana', 'levante', 'levar', 'libio', 'librado', 'lidio', 'ligado', 'ligon', 'limar', 'limpia', 'linde', 'lioso', 'liron',
  'litio', 'llenado', 'llevada', 'lobulo', 'lucifer', 'lucio', 'lujuria', 'mafioso', 'mamada', 'manolo', 'maori', 'marco', 'marica', 'maricon',
  'masacre', 'mason', 'matanza', 'maxima', 'mediana', 'medula', 'menudo', 'merlin', 'metano', 'metido', 'miente', 'mierda', 'migra', 'millon',
  'milord', 'minal', 'minima', 'mirto', 'mister', 'mitra', 'mojada', 'monada', 'monda', 'montado', 'morbo', 'morfina', 'morgue', 'moton',
  'movida', 'mutar', 'nacar', 'navidad', 'negado', 'ninguno', 'novena', 'noveno', 'nublo', 'nuclear', 'nuestro', 'obispo', 'obito', 'octava',
  'octavo', 'octubre', 'ocular', 'odeon', 'ojito', 'orgasmo', 'orinar', 'orujo', 'otero', 'oxigeno', 'pacer', 'palio', 'palta', 'pampa',
  'pancho', 'parado', 'pargo', 'parsi', 'pasada', 'pascal', 'pascua', 'pedio', 'pegada', 'pegado', 'pelma', 'pelon', 'pendejo', 'penique',
  'peral', 'perca', 'perrito', 'pesada', 'picado', 'pienso', 'pilon', 'pinar', 'pinche', 'pintado', 'piola', 'pitar', 'planeo', 'planto',
  'plexo', 'polaco', 'polca', 'pomez', 'ponto', 'poquito', 'porque', 'poseido', 'potra', 'preste', 'presto', 'procura', 'prole', 'puerco',
  'pugil', 'quemado', 'quieto', 'quilo', 'quimica', 'quimico', 'quinto', 'rabino', 'racista', 'radon', 'ralea', 'ramal', 'ramera', 'raudo',
  'reactor', 'recibi', 'recien', 'redonda', 'regir', 'rengo', 'repente', 'resulta', 'retrete', 'rever', 'riera', 'rizar', 'rolla', 'romano',
  'romeo', 'romero', 'rondo', 'rozar', 'rublo', 'rubro', 'rueca', 'sabado', 'sacra', 'sadico', 'salar', 'salvado', 'samurai', 'sardo',
  'sarro', 'sauco', 'secreta', 'sedar', 'seguida', 'segunda', 'segur', 'sellado', 'senado', 'senador', 'sensual', 'sentada', 'septimo', 'servo',
  'sesgo', 'sheriff', 'siega', 'silbo', 'simil', 'simon', 'sirio', 'siseo', 'sismo', 'solito', 'sonso', 'sopor', 'sucre', 'suelta',
  'suelto', 'sufrido', 'suicida', 'sultan', 'supero', 'suprema', 'sutura', 'tabor', 'tahur', 'talan', 'talio', 'tambo', 'tarado', 'tarso',
  'tasca', 'tebeo', 'telex', 'tendido', 'tequila', 'tercero', 'teson', 'tetas', 'tibor', 'tilin', 'timba', 'timbo', 'tirada', 'tirado',
  'tocon', 'tonga', 'tongo', 'topar', 'tordo', 'toreo', 'torio', 'tortura', 'torturar', 'toxina', 'trasera', 'traves', 'trino', 'trola',
  'ujier', 'uranio', 'usura', 'varga', 'vencida', 'verdugo', 'vermu', 'vidente', 'vienes', 'violado', 'violar', 'vivido', 'vomitar', 'vomito',
  'vuestro', 'vulgo', 'xenon', 'yanqui', 'yaqui', 'yermo', 'yesca', 'yogui', 'zarza', 'zonzo',
]);

// English counterpart: names, places, slang, vulgarity, inflected forms and function words.
const EN_EXCLUDE_V11 = new Set([
  'aargh', 'admiral', 'against', 'alaska', 'algae', 'almost', 'already', 'alright', 'amazon', 'amiss', 'amnesia', 'amongst', 'anatomy', 'anomaly',
  'another', 'anybody', 'anyhow', 'anymore', 'anyone', 'anytime', 'anyway', 'apollo', 'arctic', 'asshole', 'asthma', 'atomic', 'audible', 'august',
  'auntie', 'autopsy', 'awfully', 'awoke', 'bailey', 'barely', 'batman', 'beaten', 'became', 'because', 'begged', 'begging', 'behalf', 'bender',
  'berlin', 'beside', 'better', 'betting', 'between', 'beyond', 'bidding', 'bigger', 'biggest', 'billion', 'biology', 'bitten', 'boston', 'bought',
  'bourbon', 'brazil', 'breast', 'brent', 'briefly', 'brock', 'broken', 'brothel', 'brought', 'bugger', 'bugging', 'burke', 'burton', 'buster',
  'butch', 'caesar', 'calmly', 'cannot', 'capitol', 'carbon', 'cardiac', 'carter', 'caught', 'certain', 'chapman', 'charley', 'charlie', 'cheaper',
  'chino', 'chopped', 'chosen', 'chronic', 'chuck', 'clearer', 'clearly', 'closely', 'closer', 'closest', 'cocaine', 'coffin', 'colonel', 'condom',
  'cooler', 'coolest', 'cooper', 'corky', 'corpse', 'cosmic', 'crappy', 'cubic', 'cuddy', 'cutting', 'dalton', 'danish', 'darker', 'darkest',
  'darling', 'dearest', 'dearly', 'deeper', 'deepest', 'deeply', 'default', 'despite', 'dicky', 'digging', 'dildo', 'douche', 'dragged', 'drake',
  'dreamt', 'driven', 'dropped', 'earlier', 'easier', 'easiest', 'easily', 'eastern', 'ecstasy', 'eighth', 'either', 'eldest', 'eleven', 'embassy',
  'english', 'equally', 'erotic', 'ether', 'exactly', 'except', 'faggot', 'fairly', 'fallen', 'farther', 'fascist', 'faster', 'fastest', 'federal',
  'femur', 'fifteen', 'finally', 'finest', 'firmly', 'firstly', 'fisher', 'fitting', 'flipped', 'forgot', 'foster', 'fought', 'fourth', 'frankly',
  'freely', 'freeman', 'french', 'friday', 'fritz', 'frozen', 'fucker', 'further', 'gagging', 'garth', 'gemma', 'genetic', 'genoa', 'gently',
  'genuine', 'german', 'gestapo', 'getting', 'getup', 'gibson', 'gilbert', 'gladly', 'goddamn', 'gonzo', 'goodbye', 'gotten', 'grabbed', 'graham',
  'grandad', 'grandma', 'grandpa', 'granny', 'greater', 'greatly', 'griffin', 'guinea', 'halfway', 'hanky', 'happier', 'happily', 'harder', 'hardest',
  'hardly', 'harper', 'harry', 'heavier', 'heavily', 'hector', 'henry', 'hereby', 'heroin', 'herself', 'hidden', 'higher', 'highest', 'highly',
  'himself', 'hitting', 'holden', 'holland', 'homer', 'honda', 'hooch', 'hooker', 'hooky', 'hooray', 'hotter', 'hottest', 'however', 'hugging',
  'humming', 'hundred', 'hussy', 'idiotic', 'itself', 'jackass', 'jammed', 'jasper', 'jihad', 'jimmy', 'johnny', 'joseph', 'junkie', 'karaoke',
  'kidding', 'killer', 'kindly', 'klutz', 'kraft', 'lambert', 'larger', 'largest', 'lately', 'latest', 'latex', 'learnt', 'legally', 'lesbian',
  'lewis', 'liaison', 'lighter', 'lightly', 'likely', 'lively', 'longer', 'longest', 'louder', 'loudly', 'louie', 'louis', 'lowest', 'lucifer',
  'luckily', 'lunatic', 'madame', 'magnum', 'mainly', 'majesty', 'maniac', 'marcel', 'marshal', 'martial', 'martin', 'martini', 'mason', 'massa',
  'matey', 'matrix', 'maxwell', 'mayan', 'mercury', 'merely', 'meteor', 'mickey', 'miller', 'million', 'missus', 'monday', 'monthly', 'morgue',
  'moron', 'morris', 'mosque', 'mostly', 'mucus', 'murder', 'murphy', 'myself', 'nagging', 'nappy', 'naughty', 'nearby', 'nearest', 'nearly',
  'neither', 'nelson', 'newest', 'newton', 'nicely', 'nicest', 'ninny', 'nobody', 'nothing', 'nowhere', 'nuclear', 'nylon', 'obvious', 'october',
  'olden', 'oldest', 'oneself', 'ongoing', 'onstage', 'openly', 'orgasm', 'overall', 'oxford', 'oxygen', 'ozone', 'pacific', 'palmer', 'parker',
  'partly', 'pedro', 'penal', 'pence', 'perhaps', 'pervert', 'petrol', 'phoenix', 'pilar', 'pinned', 'planned', 'plasma', 'playboy', 'poorly',
  'popped', 'popping', 'porky', 'potter', 'primo', 'privy', 'protein', 'proven', 'psycho', 'pubic', 'purely', 'quantum', 'quark', 'quicker',
  'quickly', 'quietly', 'racist', 'radius', 'ralph', 'rapidly', 'rapist', 'rarely', 'rather', 'reactor', 'realise', 'realize', 'really', 'renal',
  'resin', 'richer', 'richest', 'rigged', 'riley', 'ripped', 'ripping', 'robbed', 'robbing', 'roger', 'romeo', 'roughly', 'rowan', 'rubbing',
  'rummy', 'running', 'safely', 'scotch', 'scrooge', 'seizure', 'senator', 'seventh', 'several', 'sexual', 'shaken', 'shalt', 'sharply', 'sheriff',
  'shipped', 'shitty', 'shorter', 'shortly', 'shorty', 'sierra', 'sigma', 'similar', 'simpler', 'simply', 'sinus', 'sitting', 'sixteen', 'skinner',
  'skipped', 'slapped', 'slavery', 'slipped', 'slower', 'slowly', 'smaller', 'smarter', 'smith', 'sobbing', 'softly', 'someday', 'somehow', 'someone',
  'sooner', 'sought', 'soviet', 'spencer', 'spoken', 'spotted', 'spunk', 'stabbed', 'stinky', 'stolen', 'stopped', 'struck', 'stunned', 'stupid',
  'sucker', 'suicide', 'sunday', 'surely', 'sutra', 'swede', 'sweetie', 'swollen', 'taller', 'tanner', 'tapped', 'tapping', 'tarzan', 'taught',
  'telly', 'tequila', 'thesis', 'theta', 'thine', 'thirty', 'though', 'thought', 'through', 'thrown', 'tighter', 'tightly', 'timothy', 'tipped',
  'titanic', 'titty', 'toddy', 'torah', 'torture', 'totally', 'tougher', 'toward', 'toxin', 'trapped', 'tripped', 'tucker', 'turner', 'twain',
  'twelve', 'twenty', 'twerp', 'typical', 'ulcer', 'unaware', 'undress', 'unless', 'unlike', 'uranium', 'usually', 'utterly', 'vagina', 'various',
  'versus', 'victor', 'vinyl', 'vroom', 'walker', 'warmer', 'warner', 'warren', 'webster', 'weekly', 'weirdo', 'welch', 'welcome', 'western',
  'wheeler', 'whereas', 'whether', 'whilst', 'whiskey', 'whisky', 'whoever', 'winning', 'within', 'without', 'woody', 'wrapped', 'wright', 'written',
]);

// Second pass over what the first exclusions let through (2026-09-15).
const ES_EXCLUDE_V11_B = new Set([
  'sobon', 'derbi', 'mocho', 'urdir', 'aullo', 'estio', 'grana', 'braza',
  'a\u00f1adido', 'afilado', 'afilo', 'aforo', 'aliso', 'amate', 'amura', 'andel', 'aspid', 'augusto', 'baboso', 'badal', 'bajada', 'balar',
  'balda', 'bantu', 'barrido', 'batan', 'batida', 'bengala', 'billa', 'bocha', 'borax', 'brama', 'brete', 'bruza', 'cafre', 'calco',
  'calzado', 'camilo', 'carca', 'cariz', 'carnal', 'casal', 'chaja', 'chaman', 'chano', 'choto', 'chucho', 'chusma', 'cianuro', 'cidra',
  'co\u00f1azo', 'cogida', 'colado', 'comento', 'coreo', 'corva', 'creso', 'criba', 'datar', 'diodo', 'docto', 'egipcio', 'erotico', 'estay',
  'fajin', 'falcon', 'follon', 'friso', 'fulano', 'fular', 'gaban', 'gacho', 'galio', 'guija', 'hachis', 'hacho', 'hamster', 'hereje',
  'hilio', 'hueva', 'hulla', 'husar', 'idiotez', 'iraqui', 'jubon', 'labra', 'lacayo', 'leton', 'lisiado', 'lucido', 'majal', 'malaria',
  'maniqui', 'masia', 'mesita', 'minue', 'misal', 'mogol', 'montada', 'mormon', 'muelo', 'mufti', 'murga', 'nidal', 'nimbo', 'nimio',
  'nipon', 'nodriza', 'nupcial', 'oblea', 'oporto', 'oraculo', 'pagano', 'palpo', 'pando', 'pareo', 'parne', 'parroco', 'paton', 'picaro',
  'pichi', 'picon', 'pifia', 'pincho', 'pinocho', 'pirar', 'pisto', 'pivot', 'projimo', 'pubico', 'pucho', 'quejar', 'quina', 'racismo',
  'razia', 'reata', 'regala', 'renda', 'rezado', 'riada', 'rizado', 'rufian', 'sacada', 'saeta', 'salina', 'sanson', 'secado', 'septo',
  'solaz', 'solio', 'sorgo', 'sure\u00f1o', 'tajada', 'talma', 'testa', 'teton', 'tique', 'tirania', 'tizon', 'tocho', 'tolva', 'tostado',
  'trasto', 'trona', 'tuteo', 'urico', 'vario', 'venida', 'viruela', 'vitor', 'zampa', 'zonal', 'zueco',
]);
const EN_EXCLUDE_V11_B = new Set([
  'xerox', 'actin', 'tutti', 'humph', 'doozy', 'pokey', 'sappy', 'swill', 'stunk', 'knelt', 'drier', 'uncut', 'dicey', 'hunky',
  'abusive', 'amino', 'attaboy', 'barker', 'bennet', 'bigfoot', 'bigot', 'blimey', 'bologna', 'brava', 'bravely', 'bristol', 'burrito', 'carver',
  'chewy', 'cognac', 'colder', 'covet', 'cuppa', 'cushy', 'cutest', 'cyanide', 'decker', 'demonic', 'dickens', 'dickie', 'dioxide', 'doggie',
  'dolce', 'edict', 'eighty', 'firemen', 'fitted', 'flaky', 'forgave', 'fowler', 'franc', 'fuhrer', 'fuller', 'funnier', 'genesis', 'goodman',
  'gooey', 'granger', 'grope', 'hamburg', 'heinous', 'helix', 'honky', 'hugged', 'immoral', 'inept', 'inhuman', 'insulin', 'inter', 'jamming',
  'jogging', 'kaput', 'kooky', 'langley', 'largely', 'lasagna', 'lemur', 'lesser', 'livid', 'madre', 'midget', 'mitzvah', 'moldy', 'morally',
  'morocco', 'mustang', 'nipple', 'nonstop', 'nosey', 'nymph', 'obscene', 'oldie', 'overly', 'panama', 'playa', 'plugged', 'poppa', 'proudly',
  'quieter', 'racial', 'ratty', 'retard', 'rightly', 'righty', 'ripper', 'risotto', 'rubbed', 'safest', 'sawyer', 'scamp', 'schmuck', 'seldom',
  'seventy', 'signor', 'signora', 'sinned', 'slater', 'sleeper', 'soapy', 'solely', 'spence', 'squaw', 'stirred', 'sweeter', 'tater', 'thicker',
  'thinner', 'tibia', 'tripe', 'undone', 'undue', 'upstate', 'vaguely', 'viking', 'violate', 'warsaw', 'weaker', 'weakest', 'wedded', 'whatnot',
  'whitey', 'wildest', 'wildly', 'woozy',
]);

// Blocked in English only: ordinary words in Spanish (the colour 'negro'), slurs in English.
const EN_BLOCK = new Set(['negro', 'negra']);

// English-only answer exclusions: Spanish loanwords and names that are ordinary words in Spanish.
const EN_ANSWER_EXCLUDE = new Set([
  'rehen', 'apuro', 'pillo', 'cursi', 'chico', 'amigo', 'macho', 'senor', 'padre', 'costa', 'titan', 'ninja', 'vodka', 'sushi', 'pizza', 'salsa', 'pasta', 'tango', 'rodeo', 'bingo', 'bravo', 'mafia', 'disco', 'opera', 'curry',
]);

// First names show up lowercased in subtitle corpora; never use them as answers.
const NAMES = new Set(read('first-names.txt').map((w) => w.trim().toLowerCase()).filter(Boolean));

const normEs = (w) =>
  w
    .toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');

// ---------- Per length ----------
// Answers per language and length. Longer words are rarer in real text, so the
// frequency floor is the same but the lists are shorter (docs/context/06-v1.1.md).
const LENGTHS = [5, 6, 7];
const TARGETS = {
  en: { 5: 1300, 6: 1000, 7: 900 },
  // Spanish 5-letter lemmas run out of everyday words near 1,100; past that the
  // frequency ranking hands out archaisms (reviewed 2026-09-15).
  es: { 5: 1100, 6: 1000, 7: 900 },
};
const target = (lang, len) => Number(process.env[`${lang.toUpperCase()}_ANSWERS_${len}`] ?? TARGETS[lang][len]);
const fileFor = (lang, len) => path.join(out, `${lang}${len === 5 ? '' : len}.json`);
const isLen = (len) => (re) => (w) => w.length === len && re.test(w);

// ---------- English ----------
{
  const alpha = read('words_alpha.txt').map((w) => w.trim());
  const enFull = freq('en_full.txt');
  const popularAll = read('popular.txt').map((w) => w.trim());
  // Every dictionary word 2..7 letters, to spot plurals, past tenses and -ing forms.
  const dictAll = new Set(alpha.filter((w) => /^[a-z]{2,7}$/.test(w)));
  const isPlural = (w) => w.endsWith('s') && !w.endsWith('ss') && (dictAll.has(w.slice(0, -1)) || (w.endsWith('ies') && dictAll.has(w.slice(0, -3) + 'y')) || (w.endsWith('es') && dictAll.has(w.slice(0, -2))));
  const isPast = (w) => w.endsWith('ed') && (dictAll.has(w.slice(0, -2)) || dictAll.has(w.slice(0, -1)) || (w.endsWith('ied') && dictAll.has(w.slice(0, -3) + 'y')));
  const isGerund = (w) => w.endsWith('ing') && (dictAll.has(w.slice(0, -3)) || dictAll.has(w.slice(0, -3) + 'e'));

  for (const len of LENGTHS) {
    const shaped = isLen(len)(/^[a-z]+$/);
    const dict = new Set(alpha.filter(shaped));
    const popular = new Set(popularAll.filter(shaped));
    const answers = [...popular]
      .filter((w) => dict.has(w) && (enFull.get(w) ?? 0) >= 40 && !BLOCK.has(w) && !EN_BLOCK.has(w) && !NAMES.has(w) && !ANSWER_EXCLUDE.has(w) && !EN_ANSWER_EXCLUDE.has(w) && !EN_EXCLUDE_V11.has(w) && !EN_EXCLUDE_V11_B.has(w))
      .filter((w) => !isPlural(w) && !isPast(w) && !isGerund(w))
      .sort((a, b) => (enFull.get(b) ?? 0) - (enFull.get(a) ?? 0))
      .slice(0, target('en', len));
    const allowedSet = new Set(answers);
    for (const w of dict) if ((enFull.get(w) ?? 0) >= 3 && !BLOCK.has(w) && !EN_BLOCK.has(w)) allowedSet.add(w);
    const allowed = [...allowedSet].sort();
    writeFileSync(fileFor('en', len), JSON.stringify({ language: 'en', length: len, answers, allowed }));
    console.log(`en ${len}: ${answers.length} answers, ${allowed.length} allowed`);
  }
}

// ---------- Spanish ----------
{
  const esFull = freq('es_full.txt');
  const lorenAll = read('es_words_loren.txt').map((w) => normEs(w.trim()));
  const lemarioAll = read('es_lemario.txt').map((w) => normEs(w.trim()));
  const enCommon = new Set(read('google-10000.txt').map((w) => w.trim()));
  // michmech/lemmatization-lists (lemma<TAB>form): a word counts as a base form only if
  // it is a LEMMA there too. The lemario alone lists many conjugations as entries.
  const lemmas = new Set();
  for (const line of read('lemmatization-es.txt')) {
    const [lemma] = line.replace(/^\uFEFF/, '').split('\t');
    if (lemma) lemmas.add(normEs(lemma.trim()));
  }
  const ES_LEMMA_MIN = Number(process.env.ES_LEMMA_MIN ?? 40);

  // Merge accent variants under their normalised form (limón + limon -> limon), any length.
  const fullNorm = new Map();
  for (const [w, c] of esFull) {
    if (!/^[a-záéíóúüñ]+$/.test(w)) continue;
    const n = normEs(w);
    fullNorm.set(n, (fullNorm.get(n) ?? 0) + c);
  }

  for (const len of LENGTHS) {
    const shaped = isLen(len)(/^[a-zñ]+$/);
    // Spanish dictionary with conjugations, already accent-free (lorenbrichter/Words).
    const esDict = new Set(lorenAll.filter(shaped));
    // olea/lemarios: dictionary headwords. Answers are BASE FORMS ONLY (infinitives,
    // singular nouns, masculine singular adjectives): no conjugations, no plurals.
    const lemario = new Set(lemarioAll.filter(shaped));
    const answers = [...lemario]
      .filter((w) => esDict.has(w) && lemmas.has(w) && (fullNorm.get(w) ?? 0) >= ES_LEMMA_MIN)
      .filter((w) => !BLOCK.has(w) && !NAMES.has(w) && !ANSWER_EXCLUDE.has(w) && !SPAIN_ONLY.has(w) && !ES_EXCLUDE_V11.has(w) && !ES_EXCLUDE_V11_B.has(w))
      .filter((w) => !(enCommon.has(w) && (fullNorm.get(w) ?? 0) < 5000))
      .sort((a, b) => (fullNorm.get(b) ?? 0) - (fullNorm.get(a) ?? 0))
      .slice(0, target('es', len));
    // Allowed: dictionary words only. The subtitle corpus is NOT used here: it is
    // full of English words (cloud, party...) that must not count as Spanish.
    const allowedSet = new Set(answers);
    for (const w of esDict) if (!BLOCK.has(w)) allowedSet.add(w);
    const allowed = [...allowedSet].sort();
    writeFileSync(fileFor('es', len), JSON.stringify({ language: 'es', length: len, answers, allowed }));
    console.log(`es ${len}: ${answers.length} answers, ${allowed.length} allowed`);
  }
}
