import { useCallback, useEffect, useRef, useState } from 'react';

import { useWatchBoss } from '../api/watch-boss/useWatchBoss';
import { openBossChannel, type BossChannelMessage } from '../helpers/boss-channel';
import type { BossViewModel } from '../models/boss-view.model';

/** At most this often, so a ticking clock does not flood the channel. */
const PUBLISH_EVERY_MS = 120;
/** A viewer that stops renewing is treated as gone. */
const VIEWER_TIMEOUT_MS = 4000;

/**
 * The game tab's half of the brain link: it publishes the fly's state for the
 * brain tab, and keeps the server's frame stream on only while somebody is
 * actually reading it.
 */
export const useBossBroadcast = (roomCode: string, boss: BossViewModel | null): void => {
  const channel = useRef<BroadcastChannel | null>(null);
  const latest = useRef<{ roomCode: string; boss: BossViewModel | null }>({ roomCode, boss });
  const sentAt = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewerUntil = useRef(0);
  const watchingRef = useRef(false);
  const [watching, setWatching] = useState(false);
  latest.current = { roomCode, boss };
  watchingRef.current = watching;

  const change = useCallback((value: boolean) => {
    setWatching((current) => (current === value ? current : value));
  }, []);

  useEffect(() => {
    const bus = openBossChannel();
    if (!bus) return;
    channel.current = bus;

    const publish = () => {
      sentAt.current = Date.now();
      const message: BossChannelMessage = { kind: 'state', ...latest.current };
      bus.postMessage(message);
    };

    bus.onmessage = (event: MessageEvent<BossChannelMessage>) => {
      const message = event.data;
      // Another game in another tab has its own viewers; this is not for us.
      if (message.kind === 'state' || message.roomCode !== latest.current.roomCode) return;
      if (message.kind === 'hello') {
        viewerUntil.current = Date.now() + VIEWER_TIMEOUT_MS;
        change(true);
        publish();
        return;
      }
      if (message.kind === 'viewer') {
        viewerUntil.current = message.open ? Date.now() + VIEWER_TIMEOUT_MS : 0;
        change(message.open);
      }
    };

    // A viewer that closed its tab without saying so stops renewing.
    const sweep = setInterval(() => {
      if (watchingRef.current && Date.now() > viewerUntil.current) change(false);
    }, 1000);

    return () => {
      clearInterval(sweep);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      bus.onmessage = null;
      bus.close();
      channel.current = null;
    };
  }, [change]);

  // Every change reaches the viewer, but never more than one per window.
  useEffect(() => {
    const bus = channel.current;
    if (!bus || !watching) return;
    const send = () => {
      sentAt.current = Date.now();
      pending.current = null;
      const message: BossChannelMessage = { kind: 'state', ...latest.current };
      bus.postMessage(message);
    };
    const since = Date.now() - sentAt.current;
    if (since >= PUBLISH_EVERY_MS) {
      send();
      return;
    }
    if (pending.current) return;
    pending.current = setTimeout(send, PUBLISH_EVERY_MS - since);
  }, [roomCode, boss, watching]);

  // No viewer, no stream: the worker only simulates while it is being read.
  useWatchBoss(watching);
};
