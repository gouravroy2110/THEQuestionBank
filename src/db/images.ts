import { db, getSetting, setSetting } from './schema';
import type { ImageRecord, UUID } from '../types';
import { v4 as uuid } from 'uuid';

const DIR_HANDLE_KEY = 'imageDirectoryHandle';

// ─── Directory handle ─────────────────────────────────────────────────────────

export async function getImageDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  return (await getSetting<FileSystemDirectoryHandle>(DIR_HANDLE_KEY)) ?? null;
}

export async function setImageDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await setSetting(DIR_HANDLE_KEY, handle);
}

export async function requestImageDirPermission(): Promise<'granted' | 'denied' | 'no-handle'> {
  const handle = await getImageDirHandle();
  if (!handle) return 'no-handle';
  try {
    const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
    return perm === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function pickImageDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    // @ts-ignore – TS lib may not have showDirectoryPicker yet
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await setImageDirHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'png';
}

export async function storeImage(
  blob: Blob,
  mimeType: string,
): Promise<ImageRecord | null> {
  const handle = await getImageDirHandle();
  if (!handle) return null;

  const imageId = uuid();
  const ext = extFromMime(mimeType);
  const filename = `${imageId}.${ext}`;

  // Get dimensions
  let width = 0, height = 0;
  try {
    const bmp = await createImageBitmap(blob);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {}

  // Write file
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();

  const record: ImageRecord = {
    id: imageId,
    filename,
    ext,
    mimeType,
    width,
    height,
    addedAt: Date.now(),
  };
  await db.images.put(record);
  return record;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

const objectUrlCache = new Map<UUID, string>();

export async function getImageObjectUrl(imageId: UUID): Promise<string | null> {
  if (objectUrlCache.has(imageId)) return objectUrlCache.get(imageId)!;

  const handle = await getImageDirHandle();
  if (!handle) return null;

  const record = await db.images.get(imageId);
  if (!record) return null;

  try {
    const fileHandle = await handle.getFileHandle(record.filename);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    objectUrlCache.set(imageId, url);
    return url;
  } catch {
    return null;
  }
}

export function revokeImageUrl(imageId: UUID): void {
  const url = objectUrlCache.get(imageId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlCache.delete(imageId);
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function findOrphanedImages(): Promise<string[]> {
  const handle = await getImageDirHandle();
  if (!handle) return [];

  // Collect all referenced imageIds from all questions
  const questions = await db.questions.toArray();
  const referenced = new Set<UUID>();
  for (const q of questions) {
    for (const seg of [...q.questionContent.segments, ...q.solutionContent.segments]) {
      if (seg.type === 'image') referenced.add(seg.imageId);
    }
  }

  // Collect files in directory
  const orphans: string[] = [];
  for await (const entry of (handle as any).values()) {
    if (entry.kind === 'file') {
      const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '');
      if (!referenced.has(nameWithoutExt)) {
        orphans.push(entry.name);
      }
    }
  }
  return orphans;
}
