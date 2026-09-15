import { useEffect, useRef } from 'react';

import { sound } from '@/shared/lib/sound';

import { LOW_TIME_THRESHOLD } from '../stores/useGameStore';

/** The last few seconds get a tick each; before that, one warning. */
const TICK_FROM = 5;

/**
 * Your own clock, out loud. The warning fires once when you cross the low-time
 * line, and the last five seconds tick — so you can keep your eyes on the board
 * instead of the number.
 *
 * Both reset when the clock climbs back up, because it does: a new letter pays
 * time, and a player who claws their way out of the red should hear the warning
 * again if they fall back in.
 */
export const useClockSounds = (secondsLeft: number, running: boolean): void => {
  const warned = useRef(false);
  const lastTick = useRef(-1);

  useEffect(() => {
    if (!running) {
      warned.current = false;
      lastTick.current = -1;
      return;
    }

    if (secondsLeft > LOW_TIME_THRESHOLD) {
      warned.current = false;
    } else if (!warned.current) {
      warned.current = true;
      sound.play('lowTime');
    }

    const second = Math.ceil(secondsLeft);
    if (second > TICK_FROM || second <= 0) {
      lastTick.current = -1;
      return;
    }
    if (second !== lastTick.current) {
      lastTick.current = second;
      sound.play('tick');
    }
  }, [secondsLeft, running]);
};
