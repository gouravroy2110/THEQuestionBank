import { useEffect, useRef } from 'react';
import type { SyncMessage } from '../types';

const CHANNEL_NAME = 'mockbank-sync';

export function useBroadcast(onMessage: (msg: SyncMessage) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (e: MessageEvent<SyncMessage>) => handlerRef.current(e.data);
    return () => ch.close();
  }, []);
}

export function broadcast(msg: SyncMessage) {
  const ch = new BroadcastChannel(CHANNEL_NAME);
  ch.postMessage(msg);
  ch.close();
}
