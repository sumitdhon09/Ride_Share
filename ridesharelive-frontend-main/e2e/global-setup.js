import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..", "..", "ridesharelive-backend-main");

async function waitFor(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  execFileSync("docker", ["compose", "up", "-d"], {
    cwd: backendDir,
    stdio: "inherit",
  });

  await waitFor("http://127.0.0.1:8080/health");
  await waitFor("http://127.0.0.1:8025/api/v1/info");
}
