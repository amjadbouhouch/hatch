import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function loadAgentFiles(
  hatchHome: string,
  workspaceId: string,
): { soul: string; identity: string } {
  const wsDir = join(hatchHome, "workspaces", workspaceId);

  const soulPath = join(wsDir, "SOUL.md");
  const identityPath = join(wsDir, "IDENTITY.md");

  const soul = existsSync(soulPath)
    ? readFileSync(soulPath, "utf-8")
    : "";
  const identity = existsSync(identityPath)
    ? readFileSync(identityPath, "utf-8")
    : "";

  return { soul, identity };
}

export function buildInstructions(soul: string, identity: string): string {
  const parts: string[] = [];

  if (soul) {
    parts.push(soul.trim());
  }

  if (identity) {
    parts.push(
      "# Current Identity\n\nThe following is your identity file. Update it as you learn about the user and project.\n\n" +
      identity.trim(),
    );
  }

  return parts.join("\n\n---\n\n");
}