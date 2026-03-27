import { useState, useEffect, useId } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, ExternalLinkIcon, LoaderIcon } from "lucide-react";
import { useEmbeddingConfig, useSaveEmbeddingConfig } from "../../hooks/use-configs.js";

// ─── Presets ────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "text-embedding-3-small", id: "openrouter/openai/text-embedding-3-small", dims: 1536, tokens: 8191 },
  { label: "text-embedding-3-large", id: "openrouter/openai/text-embedding-3-large", dims: 3072, tokens: 8191 },
  { label: "text-embedding-ada-002", id: "openrouter/openai/text-embedding-ada-002", dims: 1536, tokens: 8191 },
  { label: "gemini-embedding-001", id: "openrouter/google/gemini-embedding-001", dims: 768, tokens: 2048 },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function EmbeddingSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: config, isLoading } = useEmbeddingConfig(workspaceId);
  const { mutate: save, isPending: isSaving } = useSaveEmbeddingConfig();

  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customProviderId, setCustomProviderId] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const id = useId();
  const modelId = `${id}-model`;
  const apiKeyId = `${id}-apikey`;
  const customToggleId = `${id}-custom`;

  // Sync server state → form state
  useEffect(() => {
    if (config === undefined) return;
    setModel(config?.model ?? "");
    setApiKey(config?.apiKey ?? "");
    setUseCustom(false);
    setCustomUrl("");
    setCustomProviderId("");
    setCustomModelId("");
    setCustomApiKey("");
    setLoaded(true);
  }, [config]);

  const provider = model.split("/")[0] || "";
  const activePreset = PRESETS.find((p) => p.id === model);
  const envVar =
    provider === "openai" ? "OPENAI_API_KEY"
    : provider === "google" ? "GOOGLE_GENERATIVE_AI_API_KEY"
    : provider === "openrouter" ? "OPENROUTER_API_KEY"
    : `${provider.toUpperCase()}_API_KEY`;

  const isDirty =
    loaded && (
      model !== (config?.model ?? "") ||
      apiKey !== (config?.apiKey ?? "")
    );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    const selectedPreset = PRESETS.find((p) => p.id === model);

    save({
      workspaceId,
      model: model || null,
      apiKey: apiKey || null,
      dimension: selectedPreset?.dims ?? config?.dimension ?? null,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No workspaceId — show message (e.g. when accessed from global settings without context)
  if (!workspaceId) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Select a workspace to configure embedding settings.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
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
        <Button type="submit" size="sm" disabled={!isDirty || isSaving}>
          {isSaving ? (
            <>
              <LoaderIcon className="size-3 animate-spin" />
              Saving…
            </>
          ) : (
            "Save"
          )}
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
