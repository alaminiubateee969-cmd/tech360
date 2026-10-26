import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");

async function ensureDir(dir: string) { try { await fs.mkdir(dir, { recursive: true }); } catch {} }

export async function saveFile(file: File, category: string, projectId?: string, userId?: string) {
  await ensureDir(UPLOAD_DIR);
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return await db.fileItem.create({ data: { name: file.name, category: category as any, projectId: projectId || null, sizeKb: Math.ceil(buffer.length / 1024), uploadedBy: userId || null, storagePath: filePath, mimeType: file.type || "application/octet-stream" } });
}

export async function getFile(fileId: string) { return await db.fileItem.findUnique({ where: { id: fileId } }); }
export async function deleteFile(fileId: string) {
  const file = await db.fileItem.findUnique({ where: { id: fileId } });
  if (!file) return null;
  try { await fs.unlink(file.storagePath); } catch {}
  await db.fileItem.delete({ where: { id: fileId } });
  return file;
}
