import { LightningIcon } from '@/shared/components/icons/GameIcons';
import type { Dictionary } from '@/shared/i18n';

/** Colour plan for the five looping words, taken from CreateRoom.dc.html. */
const HERO_COLORS: readonly (readonly ('g' | 'y' | 'x' | 'e')[])[] = [
  ['g', 'x', 'y', 'g', 'e'],
  ['y', 'g', 'g', 'x', 'g'],
  ['g', 'g', 'x', 'y', 'g'],
  ['x', 'g', 'g', 'g', 'y'],
  ['g', 'g', 'g', 'g', 'g'],
];

/** Front face shows even steps, back face odd steps; 5 words over 10 turns. */
const FRONT_WORDS = [0, 2, 4, 1, 3] as const;
const BACK_WORDS = [1, 3, 0, 2, 4] as const;

interface HeroProps {
  t: Dictionary['home'];
}

export const Hero = ({ t }: HeroProps) => {
  const [line1, line2] = t.headline.split('\n');
  return (
    <div className="flex flex-col gap-7">
      <div className="hero" aria-hidden="true">
        {Array.from({ length: 5 }, (_, tileIndex) => (
          <div key={tileIndex} className="hero-flip">
            <div className="hero-face hero-face-front">
              {FRONT_WORDS.map((wordIndex) => (
                <span
                  key={wordIndex}
                  className={`hero-${HERO_COLORS[wordIndex]?.[tileIndex] ?? 'e'}`}
                >
                  {t.heroWords[wordIndex]?.[tileIndex]}
                </span>
              ))}
            </div>
            <div className="hero-face hero-face-back">
              {BACK_WORDS.map((wordIndex) => (
                <span
                  key={wordIndex}
                  className={`hero-${HERO_COLORS[wordIndex]?.[tileIndex] ?? 'e'}`}
                >
                  {t.heroWords[wordIndex]?.[tileIndex]}
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
        {t.lede}
      </p>

      <div className="grid max-w-180 grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="flex gap-1" aria-hidden="true">
            <span className="h-4.5 w-4.5 rounded bg-yellow" />
            <span className="h-4.5 w-4.5 rounded bg-green" />
          </div>
          <div className="text-[15px] font-bold">{t.feature1Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{t.feature1Body}</div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="text-red">
            <LightningIcon size={20} />
          </div>
          <div className="text-[15px] font-bold">{t.feature2Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{t.feature2Body}</div>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface p-4.5">
          <div className="font-mono text-lg font-bold text-green-ink">104%</div>
          <div className="text-[15px] font-bold">{t.feature3Title}</div>
          <div className="text-[13px] leading-[1.45] text-ink-2">{t.feature3Body}</div>
        </div>
      </div>
    </div>
  );
};
