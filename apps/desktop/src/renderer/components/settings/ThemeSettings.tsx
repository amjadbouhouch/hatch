import { useEffect, useCallback } from "react";
import { useUIStore, FONT_SCALE_OPTIONS, getFontSizePixels } from "../../stores/ui-store.js";
import type { ThemeMode, AccentColor, FontScale, UIRadius } from "../../stores/ui-store.js";
import { MonitorIcon, SunIcon, MoonIcon, CheckIcon } from "lucide-react";

// ─── Accent color definitions ────────────────────────────────────────────────

const ACCENT_COLORS: {
  id: AccentColor;
  label: string;
  swatch: string; // tailwind bg class for the preview dot
  primary: string; // oklch value for light
  primaryDark: string; // oklch value for dark
}[] = [
  {
    id: "violet",
    label: "Violet",
    swatch: "bg-violet-500",
    primary: "oklch(0.488 0.217 264)",
    primaryDark: "oklch(0.588 0.217 264)",
  },
  {
    id: "blue",
    label: "Blue",
    swatch: "bg-blue-500",
    primary: "oklch(0.520 0.200 250)",
    primaryDark: "oklch(0.620 0.200 250)",
  },
  {
    id: "emerald",
    label: "Emerald",
    swatch: "bg-emerald-500",
    primary: "oklch(0.520 0.170 160)",
    primaryDark: "oklch(0.620 0.170 160)",
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "bg-rose-500",
    primary: "oklch(0.520 0.200 15)",
    primaryDark: "oklch(0.620 0.200 15)",
  },
  {
    id: "amber",
    label: "Amber",
    swatch: "bg-amber-500",
    primary: "oklch(0.560 0.170 75)",
    primaryDark: "oklch(0.660 0.170 75)",
  },
  {
    id: "cyan",
    label: "Cyan",
    swatch: "bg-cyan-500",
    primary: "oklch(0.540 0.150 200)",
    primaryDark: "oklch(0.640 0.150 200)",
  },
  {
    id: "neutral",
    label: "Neutral",
    swatch: "bg-neutral-500",
    primary: "oklch(0.450 0.020 260)",
    primaryDark: "oklch(0.600 0.020 260)",
  },
];

const RADII: { id: UIRadius; label: string; value: string; preview: string }[] = [
  { id: "none", label: "None", value: "0px", preview: "rounded-none" },
  { id: "small", label: "Small", value: "0.375rem", preview: "rounded-sm" },
  { id: "default", label: "Default", value: "0.625rem", preview: "rounded-lg" },
  { id: "large", label: "Large", value: "1rem", preview: "rounded-xl" },
  { id: "full", label: "Full", value: "9999px", preview: "rounded-full" },
];

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: typeof SunIcon }[] = [
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "system", label: "System", icon: MonitorIcon },
];

// ─── Theme applier ───────────────────────────────────────────────────────────

function resolveEffectiveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyThemeToDOM(
  mode: ThemeMode,
  accentColor: AccentColor,
  fontScale: FontScale,
  radius: UIRadius,
) {
  const root = document.documentElement;

  // Suppress transitions during theme swap
  root.classList.add("no-transitions");

  // Mode
  const effective = resolveEffectiveMode(mode);
  root.classList.toggle("dark", effective === "dark");

  // Accent color
  const accent = ACCENT_COLORS.find((c) => c.id === accentColor) ?? ACCENT_COLORS[0];
  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--ring", accent.primary);
  root.style.setProperty("--sidebar-primary", accent.primary);
  root.style.setProperty("--sidebar-ring", accent.primary);
  // Apply dark overrides if in dark mode
  if (effective === "dark") {
    root.style.setProperty("--primary", accent.primaryDark);
    root.style.setProperty("--ring", accent.primaryDark);
    root.style.setProperty("--sidebar-primary", accent.primaryDark);
    root.style.setProperty("--sidebar-ring", accent.primaryDark);
  }

  // Font size (multiplier-based)
  root.style.setProperty("font-size", `${getFontSizePixels(fontScale)}px`);

  // Border radius
  const r = RADII.find((rd) => rd.id === radius) ?? RADII[2];
  root.style.setProperty("--radius", r.value);

  // Re-enable transitions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("no-transitions");
    });
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThemeSettings() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyThemeToDOM(theme.mode, theme.accentColor, theme.fontScale, theme.radius);
  }, [theme.mode, theme.accentColor, theme.fontScale, theme.radius]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme.mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () =>
      applyThemeToDOM(theme.mode, theme.accentColor, theme.fontScale, theme.radius);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme.mode, theme.accentColor, theme.fontScale, theme.radius]);

  const handleReset = useCallback(() => {
    setTheme({ mode: "system", accentColor: "violet", fontScale: "normal", radius: "default" });
  }, [setTheme]);

  return (
    <div className="space-y-8">
      {/* ── Color mode ──────────────────────────────────────── */}
      <Section title="Color Mode" hint="Choose how the app appears on your device.">
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((opt) => {
            const active = theme.mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme({ mode: opt.id })}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <opt.icon className={`size-5 ${active ? "text-primary" : ""}`} />
                <span>{opt.label}</span>
                {active && (
                  <span className="absolute right-2 top-2">
                    <CheckIcon className="size-3.5 text-primary" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <hr className="border-border/60" />

      {/* ── Accent color ─────────────────────────────────────── */}
      <Section title="Accent Color" hint="Used for buttons, links, and active states.">
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((color) => {
            const active = theme.accentColor === color.id;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => setTheme({ accentColor: color.id })}
                aria-label={color.label}
                aria-pressed={active}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary scale-110"
                    : "border-transparent hover:border-border hover:scale-105"
                }`}
              >
                <span
                  className={`block size-6 rounded-full ${color.swatch} shadow-sm`}
                />
                {active && (
                  <CheckIcon className="absolute size-3 text-white drop-shadow-sm" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground/60">
          {ACCENT_COLORS.find((c) => c.id === theme.accentColor)?.label ?? "Violet"}
        </p>
      </Section>

      <hr className="border-border/60" />

      {/* ── Border radius ────────────────────────────────────── */}
      <Section title="Border Radius" hint="Controls the roundness of UI elements.">
        <div className="flex flex-wrap gap-2">
          {RADII.map((r) => {
            const active = theme.radius === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setTheme({ radius: r.id })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span
                  className={`block size-4 border-2 border-current ${r.preview}`}
                />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <hr className="border-border/60" />

      {/* ── Font size ────────────────────────────────────────── */}
      <Section title="Font Size" hint="Adjusts the base text size across the app.">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Text size">
          {FONT_SCALE_OPTIONS.map((option) => {
            const active = theme.fontScale === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme({ fontScale: option.value })}
                className={`rounded-lg border px-4 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span
                  style={{ fontSize: `${option.multiplier}em` }}
                  className="leading-none"
                >
                  Aa
                </span>
                <span className="ml-2">{option.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <hr className="border-border/60" />

      {/* ── Reset ────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-medium text-foreground">{title}</h3>
        {hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}
