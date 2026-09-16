import { Segmented } from '@/shared/components/ui/Segmented';
import type { GameKind } from '@/shared/contract';
import type { Dictionary } from '@/shared/i18n';

interface GameSwitchProps {
  t: Dictionary['home'];
  game: GameKind;
  onChange: (game: GameKind) => void;
}

/** Word / Guess the phrase, in the top bar of the home page: the first choice, out of the form. */
export const GameSwitch = ({ t, game, onChange }: GameSwitchProps) => (
  <Segmented<GameKind>
    size="sm"
    label={t.game}
    value={game}
    onChange={onChange}
    className="gap-1!"
    options={[
      { value: 'wordle', label: t.gameWordle },
      { value: 'phrase', label: t.gamePhrase },
    ]}
  />
);
