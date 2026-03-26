import { useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, ExternalLinkIcon } from "lucide-react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK = {
  model: "openai/text-embedding-3-small",
  apiKey: "",
  useCustomProvider: false,
  customUrl: "",
  customProviderId: "",
  customModelId: "",
  customApiKey: "",
};

const PRESETS = [
  { label: "text-embedding-3-small", id: "openai/text-embedding-3-small", dims: 1536, tokens: 8191 },
  { label: "text-embedding-3-large", id: "openai/text-embedding-3-large", dims: 3072, tokens: 8191 },
  { label: "text-embedding-ada-002", id: "openai/text-embedding-ada-002", dims: 1536, tokens: 8191 },
  { label: "gemini-embedding-001", id: "google/gemini-embedding-001", dims: 768, tokens: 2048 },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function EmbeddingSettings() {
  const [model, setModel] = useState(MOCK.model);
  const [apiKey, setApiKey] = useState(MOCK.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [useCustom, setUseCustom] = useState(MOCK.useCustomProvider);
  const [customUrl, setCustomUrl] = useState(MOCK.customUrl);
  const [customProviderId, setCustomProviderId] = useState(MOCK.customProviderId);
  const [customModelId, setCustomModelId] = useState(MOCK.customModelId);
  const [customApiKey, setCustomApiKey] = useState(MOCK.customApiKey);
  const [showCustomKey, setShowCustomKey] = useState(false);

  const id = useId();
  const modelId = `${id}-model`;
  const apiKeyId = `${id}-apikey`;
  const customToggleId = `${id}-custom`;

  const provider = model.split("/")[0] || "";
  const activePreset = PRESETS.find((p) => p.id === model);
  const envVar =
    provider === "openai" ? "OPENAI_API_KEY"
    : provider === "google" ? "GOOGLE_GENERATIVE_AI_API_KEY"
    : `${provider.toUpperCase()}_API_KEY`;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: persist settings
      }}
    >
      {/* Model */}
      <Field label="Model" htmlFor={modelId} hint={
        <>
          Used for semantic recall and RAG.
          {" · "}
          <a
            href="https://mastra.ai/models/embeddings"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Docs
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
            disabled={useCustom}
          />
          {provider && !useCustom && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {provider}
            </Badge>
          )}
        </div>
      </Field>

      {/* Presets */}
      {!useCustom && (
        <div>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Preset models"
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
              {activePreset.dims} dimensions · {activePreset.tokens.toLocaleString()} max tokens
            </p>
          )}
        </div>
      )}

      {/* API Key */}
      <Field label="API Key" htmlFor={apiKeyId} hint={
        <>Falls back to <code className="text-[10px]">{envVar}</code> if empty.</>
      }>
        <div className="relative">
          <Input
            id={apiKeyId}
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pr-8 font-mono text-xs"
            placeholder="sk-..."
            autoComplete="off"
            disabled={useCustom}
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

      {/* Custom provider toggle */}
      <div className="flex items-center gap-2.5">
        <Switch
          id={customToggleId}
          size="sm"
          checked={useCustom}
          onCheckedChange={setUseCustom}
        />
        <label htmlFor={customToggleId} className="text-xs text-muted-foreground">
          Custom OpenAI-compatible endpoint
        </label>
      </div>

      {/* Custom provider fields */}
      {useCustom && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider ID" htmlFor={`${id}-cprov`}>
              <Input
                id={`${id}-cprov`}
                value={customProviderId}
                onChange={(e) => setCustomProviderId(e.target.value)}
                className="font-mono text-xs"
                placeholder="ollama"
                spellCheck={false}
              />
            </Field>

            <Field label="Model ID" htmlFor={`${id}-cmodel`}>
              <Input
                id={`${id}-cmodel`}
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                className="font-mono text-xs"
                placeholder="nomic-embed-text"
                spellCheck={false}
              />
            </Field>
          </div>

          <Field label="URL" htmlFor={`${id}-curl`}>
            <Input
              id={`${id}-curl`}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              className="font-mono text-xs"
              placeholder="http://localhost:11434/v1"
              spellCheck={false}
            />
          </Field>

          <Field label="API Key" htmlFor={`${id}-ckey`}>
            <div className="relative">
              <Input
                id={`${id}-ckey`}
                type={showCustomKey ? "text" : "password"}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="pr-8 font-mono text-xs"
                placeholder="not-needed"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowCustomKey(!showCustomKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={showCustomKey ? "Hide custom API key" : "Show custom API key"}
              >
                {showCustomKey ? (
                  <EyeOffIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </div>
          </Field>
        </div>
      )}

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
