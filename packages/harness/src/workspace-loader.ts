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

const WORKSPACE_RULES = `
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
`.trim();

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

  parts.push(WORKSPACE_RULES);

  const now = new Date();
  parts.push(`# Current Date & Time\n\n${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} — ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`);

  return parts.join("\n\n---\n\n");
}