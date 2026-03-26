import { useState, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EyeIcon, EyeOffIcon, CheckIcon, ExternalLinkIcon } from "lucide-react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK = {
  model: "openrouter/xiaomi/mimo-v2-pro:nitro",
  apiKey: "",
  temperature: "0.7",
  maxTokens: "4096",
  useCustomProvider: false,
  customUrl: "",
  customProviderId: "",
  customModelId: "",
  customApiKey: "",
};

// ─── Validation ─────────────────────────────────────────────────────────────

function clampTemperature(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.7";
  return String(Math.min(2, Math.max(0, Math.round(num * 10) / 10)));
}

function clampMaxTokens(value: string): string {
  const num = parseInt(value, 10);
  if (isNaN(num)) return "4096";
  return String(Math.min(200000, Math.max(256, num)));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ModelSettings() {
  const [model, setModel] = useState(MOCK.model);
  const [apiKey, setApiKey] = useState(MOCK.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [temperature, setTemperature] = useState(MOCK.temperature);
  const [maxTokens, setMaxTokens] = useState(MOCK.maxTokens);
  const [useCustom, setUseCustom] = useState(MOCK.useCustomProvider);
  const [customUrl, setCustomUrl] = useState(MOCK.customUrl);
  const [customProviderId, setCustomProviderId] = useState(MOCK.customProviderId);
  const [customModelId, setCustomModelId] = useState(MOCK.customModelId);
  const [customApiKey, setCustomApiKey] = useState(MOCK.customApiKey);
  const [showCustomKey, setShowCustomKey] = useState(false);

  const id = useId();
  const modelId = `${id}-model`;
  const apiKeyId = `${id}-apikey`;
  const tempId = `${id}-temp`;
  const tokensId = `${id}-tokens`;
  const customToggleId = `${id}-custom`;

  const provider = model.split("/")[0] || "";

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

      {/* API Key */}
      <Field label="API Key" htmlFor={apiKeyId} hint="Falls back to env var if empty.">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
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
                placeholder="llama-3.3-70b"
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

      <hr className="border-border" />

      {/* Generation params */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Temperature" htmlFor={tempId} hint="0 – 2">
          <Input
            id={tempId}
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            onBlur={() => setTemperature(clampTemperature(temperature))}
            className="tabular-nums"
          />
        </Field>

        <Field label="Max tokens" htmlFor={tokensId} hint="256 – 200 000">
          <Input
            id={tokensId}
            type="number"
            step="256"
            min="256"
            max="200000"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            onBlur={() => setMaxTokens(clampMaxTokens(maxTokens))}
            className="tabular-nums"
          />
        </Field>
      </div>

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
