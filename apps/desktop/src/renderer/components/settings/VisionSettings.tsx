/**
 * Vision Model Settings
 *
 * Format: "provider/model-id" — Mastra resolves the API key from env vars
 * based on the provider (e.g. OPENROUTER_API_KEY, OPENAI_API_KEY, etc.).
 *
 * When a user uploads an image (or scanned PDF) in chat:
 * 1. handleSubmit detects the file is not text-readable
 * 2. Sends the file (base64) to this vision model for description
 * 3. The description text is wrapped in <file name="..." mime="...">...</file>
 * 4. That text is appended to the user message — agent never sees raw binary
 *
 * If the main chat model already supports vision, skip the separate call
 * and pass the image inline as base64 in the message content array.
 *
 * Same flow applies to PDF (render pages to images → vision) and Excel
 * (parse to text via sheetjs — no vision needed).
 *
 * TODO: persist to workspace config, wire into handleSubmit pipeline.
 */
import { useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EyeIcon, EyeOffIcon, ExternalLinkIcon } from "lucide-react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK = {
  model: "openrouter/google/gemini-2.5-flash-preview",
  apiKey: "",
};

const PRESETS = [
  { label: "GPT-4o", id: "openrouter/openai/gpt-4o", note: "OpenAI" },
  { label: "GPT-4o mini", id: "openrouter/openai/gpt-4o-mini", note: "OpenAI, cheaper" },
  { label: "Gemini 2.5 Flash", id: "openrouter/google/gemini-2.5-flash-preview", note: "Google, fast" },
  { label: "Claude Sonnet 4", id: "openrouter/anthropic/claude-sonnet-4", note: "Anthropic" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function VisionSettings() {
  const [model, setModel] = useState(MOCK.model);
  const [apiKey, setApiKey] = useState(MOCK.apiKey);
  const [showKey, setShowKey] = useState(false);

  const id = useId();
  const modelId = `${id}-model`;
  const apiKeyId = `${id}-apikey`;

  const provider = model.split("/").slice(0, 2).join("/") || "";
  const activePreset = PRESETS.find((p) => p.id === model);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: persist settings
      }}
    >
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Used to describe images and scanned PDFs before sending to the agent.
          Pick a model with vision capabilities.
        </p>
      </div>

      {/* Model */}
      <Field label="Vision Model" htmlFor={modelId} hint={
        <>
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">provider/model-name</code>
          {" · "}
          <a
            href="https://openrouter.ai/models?q=vision"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Browse vision models
            <ExternalLinkIcon className="size-2.5" aria-hidden="true" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        </>
      }>
        <div className="flex items-center gap-2">
          <Input
            id={modelId}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="flex-1 font-mono text-xs"
            placeholder="provider/model-name"
            spellCheck={false}
          />
          {provider && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              vision
            </Badge>
          )}
        </div>
      </Field>

      {/* Presets */}
      <div>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Preset vision models"
        >
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setModel(p.id)}
              aria-pressed={p.id === model}
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none ${
                p.id === model
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activePreset && (
          <p className="mt-1.5 text-[11px] text-muted-foreground/60">
            {activePreset.note}
          </p>
        )}
      </div>

      {/* API Key */}
      <Field label="API Key" htmlFor={apiKeyId} hint="Falls back to provider env var if empty (e.g. OPENROUTER_API_KEY).">
        <div className="relative">
          <Input
            id={apiKeyId}
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-8 font-mono text-xs"
            placeholder="sk-..."
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? (
              <EyeOffIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <EyeIcon className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </Field>

      <div className="flex justify-end pt-1">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}
