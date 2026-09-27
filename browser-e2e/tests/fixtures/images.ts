import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** A project-local generated cat portrait. It is a 512×512 JPEG (under 2 MiB). */
export const CAT_AVATAR_JPEG_FILE = {
  name: "cat-avatar.jpg",
  mimeType: "image/jpeg",
  buffer: readFileSync(
    resolve(process.cwd(), "tests", "fixtures", "assets", "cat-avatar.jpg"),
  ),
};
