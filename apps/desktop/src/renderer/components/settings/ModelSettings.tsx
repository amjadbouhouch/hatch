import { useState, useEffect, useId } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, CheckIcon, ExternalLinkIcon, LoaderIcon, ChevronDownIcon } from "lucide-react";
import { useModelConfig, useSaveModelConfig } from "../../hooks/use-configs.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert nullable number to form string */
function numToStr(v: number | null | undefined): string {
  return v != null ? String(v) : "";
}

/** Convert form string to nullable number (float) */
function strToFloat(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Convert form string to nullable number (int) */
function strToInt(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function clamp(value: string, min: number, max: number, decimals = 0): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  const clamped = Math.min(max, Math.max(min, num));
  return decimals > 0
    ? String(Math.round(clamped * 10 ** decimals) / 10 ** decimals)
    : String(Math.round(clamped));
}

function tryParseJson(str: string): Record<string, unknown> | null {
  if (!str.trim()) return null;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ModelSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: config, isLoading } = useModelConfig(workspaceId);
  const { mutate: save, isPending: isSaving } = useSaveModelConfig();

  // Basic fields
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");

  // Advanced fields
  const [topP, setTopP] = useState("");
  const [topK, setTopK] = useState("");
  const [frequencyPenalty, setFrequencyPenalty] = useState("");
  const [presencePenalty, setPresencePenalty] = useState("");
  const [maxRetries, setMaxRetries] = useState("");
  const [seed, setSeed] = useState("");
  const [providerOptions, setProviderOptions] = useState("");
  const [providerOptionsError, setProviderOptionsError] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Custom endpoint
  const [useCustom, setUseCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customProviderId, setCustomProviderId] = useState("");
  const [customModelId, setCustomModelId] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showCustomKey, setShowCustomKey] = useState(false);

  const [loaded, setLoaded] = useState(false);

  const id = useId();

  // Sync server state → form state
  useEffect(() => {
    if (config === undefined) return;
    setModel(config?.model ?? "");
    setApiKey(config?.apiKey ?? "");
    setTemperature(numToStr(config?.temperature));
    setMaxTokens(numToStr(config?.maxTokens));
    setTopP(numToStr(config?.topP));
    setTopK(numToStr(config?.topK));
    setFrequencyPenalty(numToStr(config?.frequencyPenalty));
    setPresencePenalty(numToStr(config?.presencePenalty));
    setMaxRetries(numToStr(config?.maxRetries));
    setSeed(numToStr(config?.seed));
    setProviderOptions(
      config?.providerOptions ? JSON.stringify(config.providerOptions, null, 2) : ""
    );
    setProviderOptionsError(false);
    setUseCustom(false);
    setCustomUrl("");
    setCustomProviderId("");
    setCustomModelId("");
    setCustomApiKey("");
    setLoaded(true);

    // Auto-open advanced if any advanced field has a value
    if (
      config?.topP != null ||
      config?.topK != null ||
      config?.frequencyPenalty != null ||
      config?.presencePenalty != null ||
      config?.seed != null ||
      (config?.maxRetries != null && config.maxRetries !== 3) ||
      config?.providerOptions != null
    ) {
      setAdvancedOpen(true);
    }
  }, [config]);

  const provider = model.split("/")[0] || "";

  const isDirty =
    loaded && (
      model !== (config?.model ?? "") ||
      apiKey !== (config?.apiKey ?? "") ||
      temperature !== numToStr(config?.temperature) ||
      maxTokens !== numToStr(config?.maxTokens) ||
      topP !== numToStr(config?.topP) ||
      topK !== numToStr(config?.topK) ||
      frequencyPenalty !== numToStr(config?.frequencyPenalty) ||
      presencePenalty !== numToStr(config?.presencePenalty) ||
      maxRetries !== numToStr(config?.maxRetries) ||
      seed !== numToStr(config?.seed) ||
      providerOptions !== (config?.providerOptions ? JSON.stringify(config.providerOptions, null, 2) : "")
    );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    // Validate provider options JSON
    if (providerOptions.trim() && tryParseJson(providerOptions) === null) {
      setProviderOptionsError(true);
      return;
    }

    save({
      workspaceId,
      model: model || null,
      apiKey: apiKey || null,
      temperature: strToFloat(temperature),
      maxTokens: strToInt(maxTokens),
      topP: strToFloat(topP),
      topK: strToInt(topK),
      frequencyPenalty: strToFloat(frequencyPenalty),
      presencePenalty: strToFloat(presencePenalty),
      maxRetries: strToInt(maxRetries),
      seed: strToInt(seed),
      providerOptions: tryParseJson(providerOptions),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Model */}
      <Field label="Model" htmlFor={`${id}-model`} hint={
        <>
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">provider/model-name</code>
          {" · "}
          <a
            href="https://mastra.ai/models/providers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Browse models
            <ExternalLinkIcon className="size-2.5" aria-hidden="true" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        </>
      }>
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-model`}
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

      {/* API Key */}
      <Field label="API Key" htmlFor={`${id}-apikey`} hint="Falls back to env var if empty.">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Input
              id={`${id}-apikey`}
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
              {showKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 h-8 gap-1.5"
            disabled={!apiKey.trim() || useCustom}
          >
            <CheckIcon className="size-3" />
            Verify
          </Button>
        </div>
      </Field>

      {/* Custom provider toggle */}
      <div className="flex items-center gap-2.5">
        <Switch
          id={`${id}-custom`}
          size="sm"
          checked={useCustom}
          onCheckedChange={setUseCustom}
        />
        <label htmlFor={`${id}-custom`} className="text-xs text-muted-foreground">
          Custom OpenAI-compatible endpoint
        </label>
      </div>

      {/* Custom provider fields */}
      {useCustom && (
        <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 px-4 py-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Provider ID" htmlFor={`${id}-cprov`}>
              <Input id={`${id}-cprov`} value={customProviderId} onChange={(e) => setCustomProviderId(e.target.value)} className="font-mono text-xs" placeholder="ollama" spellCheck={false} />
            </Field>
            <Field label="Model ID" htmlFor={`${id}-cmodel`}>
              <Input id={`${id}-cmodel`} value={customModelId} onChange={(e) => setCustomModelId(e.target.value)} className="font-mono text-xs" placeholder="llama-3.3-70b" spellCheck={false} />
            </Field>
          </div>
          <Field label="URL" htmlFor={`${id}-curl`}>
            <Input id={`${id}-curl`} value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} className="font-mono text-xs" placeholder="http://localhost:11434/v1" spellCheck={false} />
          </Field>
          <Field label="API Key" htmlFor={`${id}-ckey`}>
            <div className="relative">
              <Input id={`${id}-ckey`} type={showCustomKey ? "text" : "password"} value={customApiKey} onChange={(e) => setCustomApiKey(e.target.value)} className="pr-8 font-mono text-xs" placeholder="not-needed" autoComplete="off" />
              <button type="button" onClick={() => setShowCustomKey(!showCustomKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showCustomKey ? "Hide custom API key" : "Show custom API key"}>
                {showCustomKey ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </button>
            </div>
          </Field>
        </div>
      )}

      <hr className="border-border" />

      {/* Temperature + Max Tokens */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Temperature" htmlFor={`${id}-temp`} hint="0 – 2">
          <Input
            id={`${id}-temp`}
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            onBlur={() => { if (temperature) setTemperature(clamp(temperature, 0, 2, 1)); }}
            className="tabular-nums"
            placeholder="default"
          />
        </Field>

        <Field label="Max Tokens" htmlFor={`${id}-tokens`} hint="256 – 200 000">
          <Input
            id={`${id}-tokens`}
            type="number"
            step="256"
            min="256"
            max="200000"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            onBlur={() => { if (maxTokens) setMaxTokens(clamp(maxTokens, 256, 200000)); }}
            className="tabular-nums"
            placeholder="default"
          />
        </Field>
      </div>

      {/* ── Advanced Settings ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/60">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors rounded-lg"
        >
          Advanced Settings
          <ChevronDownIcon className={`size-3.5 text-muted-foreground transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
        </button>

        {advancedOpen && (
          <div className="space-y-4 px-4 pb-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {/* Top P + Frequency Penalty */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Top P" htmlFor={`${id}-topp`} hint="0 – 1">
                <Input
                  id={`${id}-topp`}
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={topP}
                  onChange={(e) => setTopP(e.target.value)}
                  onBlur={() => { if (topP) setTopP(clamp(topP, 0, 1, 2)); }}
                  className="tabular-nums"
                  placeholder="default"
                />
              </Field>

              <Field label="Top K" htmlFor={`${id}-topk`}>
                <Input
                  id={`${id}-topk`}
                  type="number"
                  step="1"
                  min="1"
                  value={topK}
                  onChange={(e) => setTopK(e.target.value)}
                  onBlur={() => { if (topK) setTopK(clamp(topK, 1, 1000)); }}
                  className="tabular-nums"
                  placeholder="default"
                />
              </Field>
            </div>

            {/* Frequency Penalty + Presence Penalty */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Frequency Penalty" htmlFor={`${id}-fp`} hint="-2 – 2">
                <Input
                  id={`${id}-fp`}
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={frequencyPenalty}
                  onChange={(e) => setFrequencyPenalty(e.target.value)}
                  onBlur={() => { if (frequencyPenalty) setFrequencyPenalty(clamp(frequencyPenalty, -2, 2, 1)); }}
                  className="tabular-nums"
                  placeholder="default"
                />
              </Field>

              <Field label="Presence Penalty" htmlFor={`${id}-pp`} hint="-2 – 2">
                <Input
                  id={`${id}-pp`}
                  type="number"
                  step="0.1"
                  min="-2"
                  max="2"
                  value={presencePenalty}
                  onChange={(e) => setPresencePenalty(e.target.value)}
                  onBlur={() => { if (presencePenalty) setPresencePenalty(clamp(presencePenalty, -2, 2, 1)); }}
                  className="tabular-nums"
                  placeholder="default"
                />
              </Field>
            </div>

            {/* Max Retries + Seed */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max Retries" htmlFor={`${id}-retries`}>
                <Input
                  id={`${id}-retries`}
                  type="number"
                  step="1"
                  min="0"
                  max="10"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(e.target.value)}
                  onBlur={() => { if (maxRetries) setMaxRetries(clamp(maxRetries, 0, 10)); }}
                  className="tabular-nums"
                  placeholder="3"
                />
              </Field>

              <Field label="Seed" htmlFor={`${id}-seed`}>
                <Input
                  id={`${id}-seed`}
                  type="number"
                  step="1"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="tabular-nums"
                  placeholder="default"
                />
              </Field>
            </div>

            {/* Provider Options (JSON) */}
            <Field label="Provider Options" hint="JSON object for provider-specific config.">
              <textarea
                value={providerOptions}
                onChange={(e) => {
                  setProviderOptions(e.target.value);
                  setProviderOptionsError(false);
                }}
                onBlur={() => {
                  if (!providerOptions.trim()) {
                    setProviderOptionsError(false);
                    return;
                  }
                  const parsed = tryParseJson(providerOptions);
                  if (parsed) {
                    setProviderOptions(JSON.stringify(parsed, null, 2));
                    setProviderOptionsError(false);
                  } else {
                    setProviderOptionsError(true);
                  }
                }}
                rows={4}
                spellCheck={false}
                className={`w-full rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  providerOptionsError
                    ? "border-destructive focus-visible:ring-destructive"
                    : "border-input"
                }`}
                placeholder={`{ "openrouter": { "reasoning": { "effort": "none" } } }`}
              />
              {providerOptionsError && (
                <p className="text-[11px] text-destructive">Invalid JSON</p>
              )}
            </Field>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" size="sm" disabled={!isDirty || isSaving || providerOptionsError}>
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
