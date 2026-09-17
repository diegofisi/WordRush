import { useEffect, useState } from 'react';

import { openBossChannel, type BossChannelMessage } from '../helpers/boss-channel';
import type { BossViewModel } from '../models/game-view.model';

/** The game tab drops a viewer that goes quiet, so say so well inside that. */
const RENEW_EVERY_MS = 1500;

export interface BossViewerState {
  boss: BossViewModel | null;
  /** False until the game tab answers: the page shows how to open one. */
  connected: boolean;
}

/**
 * The brain tab's half of the link. It never touches the socket — see
 * `helpers/boss-channel.ts` for why a second socket would cost the player their
 * seat — it announces itself and renders whatever the game tab sends.
 */
export const useBossViewer = (roomCode: string): BossViewerState => {
  const [state, setState] = useState<BossViewerState>({ boss: null, connected: false });

  useEffect(() => {
    const bus = openBossChannel();
    if (!bus) return;

    const announce = (open: boolean) => {
      const message: BossChannelMessage = { kind: 'viewer', roomCode, open };
      bus.postMessage(message);
    };

    bus.onmessage = (event: MessageEvent<BossChannelMessage>) => {
      const message = event.data;
      if (message.kind !== 'state' || message.roomCode !== roomCode) return;
      setState({ boss: message.boss, connected: true });
    };

    bus.postMessage({ kind: 'hello', roomCode } satisfies BossChannelMessage);
    announce(true);
    const renew = setInterval(() => announce(true), RENEW_EVERY_MS);

    // Closing the tab outright still gets the message out before teardown.
    const leave = () => announce(false);
    window.addEventListener('pagehide', leave);

    return () => {
      clearInterval(renew);
      window.removeEventListener('pagehide', leave);
      announce(false);
      bus.onmessage = null;
      bus.close();
    };
  }, [roomCode]);

  return state;
};
