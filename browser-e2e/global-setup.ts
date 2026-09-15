import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type { FullConfig } from "@playwright/test";

const execFileAsync = promisify(execFile);
const minioHealthUrl = "http://127.0.0.1:9000/minio/health/live";

/** Starts the local S3-compatible dependency required by real browser uploads. */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const repositoryRoot = path.resolve(__dirname, "..");

  try {
    await execFileAsync(
      "docker",
      ["compose", "-f", "docker-compose.minio.yml", "up", "-d"],
      { cwd: repositoryRoot },
    );
  } catch (error) {
    throw new Error(
      "Browser E2E requires Docker Desktop and docker-compose.minio.yml to start MinIO.",
      { cause: error },
    );
  }

  const readyDeadline = Date.now() + 30_000;
  while (Date.now() < readyDeadline) {
    try {
      const response = await fetch(minioHealthUrl);
      if (response.ok) return;
    } catch {
      // MinIO is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("MinIO did not become healthy within 30 seconds.");
}
