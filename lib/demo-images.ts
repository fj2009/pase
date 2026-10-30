import "server-only";

import { readdirSync } from "node:fs";
import path from "node:path";

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export function demoImagePaths(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), "public", "demo"))
      .filter((file) => EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort()
      .map((file) => `/demo/${file}`);
  } catch {
    return [];
  }
}
