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

const SANDBOX_RULES = `
# Workspace Rules

## Projects Folder
All work must go in /workspace/projects/. Code, reports, exports, scripts — everything you create lives there.
Create subfolders per project or task to keep things organized.
Top-level workspace files (SOUL.md, IDENTITY.md) are the only exceptions.

## Organization
Name files descriptively so their purpose is clear at a glance.
When a task produces multiple artifacts, group them in a dedicated subfolder.
Clean up temporary and intermediate files when done — keep only the final output.

## Pre-installed Libraries
Your sandbox has these libraries already installed. Use them directly — do NOT run pip install for these.

Python: numpy, pandas, openpyxl, pyyaml, pypdf, pdfplumber, reportlab, weasyprint, pytesseract, pdf2image, Pillow, matplotlib, requests, beautifulsoup4, python-docx, python-pptx
System: poppler-utils (pdftotext, pdfimages), qpdf, tesseract-ocr, Node.js, npm, git, curl, bash

## Image Analysis
When the user shares an image file (png, jpg, gif, webp), use the read_image tool to see its contents.
Pass the workspace-relative file path and optionally a prompt describing what to focus on (e.g. "Extract all text", "Describe the chart").

## Mode Switching
If your workspace has multiple modes (e.g. Auto, Build, Plan), you have a switch_mode tool.
Use it to switch between modes based on the task at hand. The user can also switch modes manually.
When you switch modes, the current generation is aborted and you restart with the new mode's instructions.
`.trim();

const PROJECT_RULES = `
# Workspace Rules — Project Mode

## File Paths
You are working directly on a local project. The project root IS your workspace root.
**Always use relative paths** — e.g. \`src/index.ts\`, \`packages/shared/src/schemas.ts\`, \`.\` to list root.
NEVER use absolute paths like \`/Users/...\` — workspace tools only accept relative paths.

## Commands
Commands execute directly on the host machine in the project directory.
You have access to the project's full toolchain — git, npm/bun, tsc, etc.
Run \`ls\` or use \`list_files\` with path \`.\` to explore the project structure.

## LSP
You have LSP code intelligence via the \`lsp_inspect\` tool. Use it to:
- Check types and hover info for symbols
- Jump to definitions
- Find implementations

## Error Recovery
If a tool call fails (file not found, wrong path), don't stop. Adjust the path and retry.
Use \`list_files\` to discover the correct structure before reading specific files.

## Mode Switching
If your workspace has multiple modes (e.g. Auto, Build, Plan), you have a switch_mode tool.
Use it to switch between modes based on the task at hand. The user can also switch modes manually.
When you switch modes, the current generation is aborted and you restart with the new mode's instructions.
`.trim();

export interface BuildInstructionsOptions {
  projectPath?: string | null;
}

export function buildInstructions(soul: string, identity: string, opts?: BuildInstructionsOptions): string {
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

  parts.push(opts?.projectPath ? PROJECT_RULES : SANDBOX_RULES);

  const now = new Date();
  parts.push(`# Current Date & Time\n\n${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`);

  return parts.join("\n\n---\n\n");
}