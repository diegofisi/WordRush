import { LightningIcon } from '@/shared/components/icons/GameIcons';
import { Segmented } from '@/shared/components/ui/Segmented';
import type { GameKind } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

/** Colour plan for the five looping words, taken from CreateRoom.dc.html. */
const HERO_COLORS: readonly (readonly ('g' | 'y' | 'x' | 'e')[])[] = [
  ['g', 'x', 'y', 'g', 'e'],
  ['y', 'g', 'g', 'x', 'g'],
  ['g', 'g', 'x', 'y', 'g'],
  ['x', 'g', 'g', 'g', 'y'],
  ['g', 'g', 'g', 'g', 'g'],
];

/** The phrase game has no yellow: a letter is in the phrase or it is not. */
const PHRASE_COLORS: readonly (readonly ('g' | 'y' | 'x' | 'e')[])[] = [
  ['g', 'x', 'g', 'g', 'e'],
  ['e', 'g', 'g', 'x', 'g'],
  ['g', 'g', 'x', 'e', 'g'],
  ['x', 'g', 'g', 'g', 'e'],
  ['g', 'g', 'g', 'g', 'g'],
];

/** Front face shows even steps, back face odd steps; 5 words over 10 turns. */
const FRONT_WORDS = [0, 2, 4, 1, 3] as const;
const BACK_WORDS = [1, 3, 0, 2, 4] as const;

interface HeroProps {
  t: Dictionary['home'];
  /** The game the room will play; the copy below follows it. */
  game: GameKind;
  onGameChange: (game: GameKind) => void;
}

/** Everything on the hero that depends on the chosen game. */
const copyFor = (t: Dictionary['home'], game: GameKind) =>
  game === 'phrase'
    ? {
        words: t.phraseHeroWords,
        colors: PHRASE_COLORS,
        headline: t.phraseHeadline,
        lede: t.phraseLede,
        feature1Title: t.phraseFeature1Title,
        feature1Body: t.phraseFeature1Body,
        feature2Title: t.phraseFeature2Title,
        feature2Body: t.phraseFeature2Body,
        feature3Title: t.phraseFeature3Title,
        feature3Body: t.phraseFeature3Body,
        feature3Figure: '+80',
      }
    : {
        words: t.heroWords,
        colors: HERO_COLORS,
        headline: t.headline,
        lede: t.lede,
        feature1Title: t.feature1Title,
        feature1Body: t.feature1Body,
        feature2Title: t.feature2Title,
        feature2Body: t.feature2Body,
        feature3Title: t.feature3Title,
        feature3Body: t.feature3Body,
        feature3Figure: '104%',
      };

export const Hero = ({ t, game, onGameChange }: HeroProps) => {
  const copy = copyFor(t, game);
  const [line1, line2] = copy.headline.split('\n');
  return (
    <div className="flex flex-col gap-7">
      {/* The game is the first choice on the page; the form below keeps the rest. */}
      <div className="flex flex-col gap-2">
        <span className="label">{t.game}</span>
        <Segmented<GameKind>
          label={t.game}
          value={game}
          onChange={onGameChange}
          className="max-w-100"
          options={[
            { value: 'wordle', label: t.gameWordle },
            { value: 'phrase', label: t.gamePhrase },
          ]}
        />
      </div>

      <div className="hero" aria-hidden="true" key={game}>
        {Array.from({ length: 5 }, (_, tileIndex) => (
          <div key={tileIndex} className="hero-flip">
            <div className="hero-face hero-face-front">
              {FRONT_WORDS.map((wordIndex) => (
                <span
                  key={wordIndex}
                  className={`hero-${copy.colors[wordIndex]?.[tileIndex] ?? 'e'}`}
                >
                  {copy.words[wordIndex]?.[tileIndex]}
                </span>
              ))}
            </div>
            <div className="hero-face hero-face-back">
              {BACK_WORDS.map((wordIndex) => (
                <span
                  key={wordIndex}
                  className={`hero-${copy.colors[wordIndex]?.[tileIndex] ?? 'e'}`}
                >
                  {copy.words[wordIndex]?.[tileIndex]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h1 className="m-0 font-display text-[clamp(40px,7vw,72px)] leading-[0.98] font-extrabold tracking-[-0.03em] text-balance">
        {line1}
        <br />
        {line2}
      </h1>
      <p className="m-0 max-w-140 text-[17px] leading-normal text-ink-2 text-pretty sm:text-[19px]">
        {copy.lede}
      </p>

      <div className="grid max-w-180 grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="flex gap-1" aria-hidden="true">
            {game === 'phrase' ? (
              <>
                <span className="h-4.5 w-4.5 rounded bg-green" />
                <span className="h-4.5 w-4.5 rounded bg-tile-gray" />
              </>
            ) : (
              <>
                <span className="h-4.5 w-4.5 rounded bg-yellow" />
                <span className="h-4.5 w-4.5 rounded bg-green" />
              </>
            )}
          </div>
          <div className="text-[15px] font-bold">{copy.feature1Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{copy.feature1Body}</div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="text-red">
            <LightningIcon size={20} />
          </div>
          <div className="text-[15px] font-bold">{copy.feature2Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{copy.feature2Body}</div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="font-mono text-lg font-bold text-green-ink">{copy.feature3Figure}</div>
          <div className="text-[15px] font-bold">{copy.feature3Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{copy.feature3Body}</div>
        </div>
      </div>
    </div>
  );
};
