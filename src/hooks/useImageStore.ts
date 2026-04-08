import { useState, useEffect, useCallback } from 'react';
import {
  requestImageDirPermission,
  pickImageDirectory,
  storeImage,
  getImageObjectUrl,
  getImageDirHandle,
} from '../db/images';
import type { ImageRecord } from '../types';

export type ImageStoreStatus = 'loading' | 'ready' | 'no-directory' | 'permission-denied';

export function useImageStore() {
  const [status, setStatus] = useState<ImageStoreStatus>('loading');

  const init = useCallback(async () => {
    const handle = await getImageDirHandle();
    if (!handle) { setStatus('no-directory'); return; }
    const perm = await requestImageDirPermission();
    if (perm === 'granted') setStatus('ready');
    else if (perm === 'denied') setStatus('permission-denied');
    else setStatus('no-directory');
  }, []);

  useEffect(() => { init(); }, [init]);

  const setupDirectory = useCallback(async (): Promise<boolean> => {
    const handle = await pickImageDirectory();
    if (handle) { setStatus('ready'); return true; }
    return false;
  }, []);

  const addImage = useCallback(async (blob: Blob, mimeType: string): Promise<ImageRecord | null> => {
    if (status !== 'ready') return null;
    return storeImage(blob, mimeType);
  }, [status]);

  const getUrl = useCallback(async (imageId: string): Promise<string | null> => {
    return getImageObjectUrl(imageId);
  }, []);

  return { status, setupDirectory, addImage, getUrl, reinit: init };
}
