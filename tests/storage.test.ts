import { describe, expect, it } from "vitest";
import { getStorage, prepareUploads, sanitizeFileName, withStoredFiles } from "@/server/storage";

const file = (name: string, bytes: number, type = "application/octet-stream") =>
  new File([new Uint8Array(bytes)], name, { type });

describe("prepareUploads", () => {
  it("ignores empty inputs and derives the MIME type from the extension", async () => {
    const result = await prepareUploads([file("", 0), file("photo.JPG", 10, "text/html")]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({ fileName: "photo.JPG", mimeType: "image/jpeg", sizeBytes: 10 });
    expect(result.files[0].checksumSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects disallowed types, oversized files and too many files", async () => {
    expect((await prepareUploads([file("evil.svg", 10)])).ok).toBe(false);
    expect((await prepareUploads([file("run.exe", 10)])).ok).toBe(false);
    expect((await prepareUploads([file("big.pdf", 10 * 1024 * 1024 + 1)])).ok).toBe(false);
    expect((await prepareUploads(Array.from({ length: 6 }, (_, i) => file(`${i}.txt`, 1)))).ok).toBe(false);
  });

  it("strips paths and control characters from names", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName('C:\\fake\\a"b\u0007.txt')).toBe("ab.txt");
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("withStoredFiles", () => {
  it("removes written files when the callback fails", async () => {
    const prepared = await prepareUploads([file("a.txt", 5)]);
    if (!prepared.ok) throw new Error(prepared.error);
    let key = "";
    await expect(
      withStoredFiles(prepared.files, async (stored) => {
        key = stored[0].storageKey;
        await expect(getStorage().read(key)).resolves.toHaveLength(5);
        throw new Error("db failed");
      }),
    ).rejects.toThrow("db failed");
    await expect(getStorage().read(key)).rejects.toThrow();
  });

  it("refuses keys that escape the upload directory", async () => {
    await expect(getStorage().read("../../etc/passwd")).rejects.toThrow("Invalid storage key");
  });
});
