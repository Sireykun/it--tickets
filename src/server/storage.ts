import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 5;

// Extension → canonical MIME type. The browser-supplied type is never trusted.
const ALLOWED_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// Raster images browsers render safely; everything else is served as a download.
export const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES).join(",");

export type PreparedFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  data: Buffer;
};

export type StoredFile = Omit<PreparedFile, "data"> & { storageKey: string };

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 200);
  return cleaned || "file";
}

// Validates and reads uploads. Empty file inputs (size 0, no name) are ignored.
export async function prepareUploads(
  entries: FormDataEntryValue[],
): Promise<{ ok: true; files: PreparedFile[] } | { ok: false; error: string }> {
  const files = entries.filter((e): e is File => typeof e !== "string" && e.size > 0);
  if (files.length > MAX_FILES_PER_MESSAGE) {
    return { ok: false, error: `You can attach up to ${MAX_FILES_PER_MESSAGE} files per message.` };
  }

  const prepared: PreparedFile[] = [];
  for (const file of files) {
    const fileName = sanitizeFileName(file.name);
    const mimeType = ALLOWED_TYPES[path.extname(fileName).toLowerCase()];
    if (!mimeType) {
      return { ok: false, error: `"${fileName}" isn't an allowed file type.` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, error: `"${fileName}" is larger than 10 MB.` };
    }
    const data = Buffer.from(await file.arrayBuffer());
    prepared.push({
      fileName,
      mimeType,
      sizeBytes: data.length,
      checksumSha256: createHash("sha256").update(data).digest("hex"),
      data,
    });
  }
  return { ok: true, files: prepared };
}

export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

class LocalDiskStorage implements FileStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error(`Invalid storage key: ${key}`);
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { flag: "wx" });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

let storage: FileStorage | undefined;

export function getStorage(): FileStorage {
  storage ??= new LocalDiskStorage(process.env.UPLOAD_DIR ?? "./uploads");
  return storage;
}

function newStorageKey(now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${randomUUID()}`;
}

// Writes files first, then runs `fn` with their metadata. If `fn` throws, the files are removed
// again so a failed database write never leaves orphaned uploads behind.
export async function withStoredFiles<T>(files: PreparedFile[], fn: (stored: StoredFile[]) => Promise<T>): Promise<T> {
  const store = getStorage();
  const stored: StoredFile[] = [];
  try {
    for (const { data, ...meta } of files) {
      const storageKey = newStorageKey();
      await store.put(storageKey, data);
      stored.push({ ...meta, storageKey });
    }
    return await fn(stored);
  } catch (err) {
    await Promise.allSettled(stored.map((f) => store.remove(f.storageKey)));
    throw err;
  }
}
