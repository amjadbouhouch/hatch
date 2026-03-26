import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheckIcon,
  TerminalIcon,
  FolderIcon,
  GlobeIcon,
  ZapIcon,
} from "lucide-react";

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK = {
  yoloMode: false,
  approvalPolicy: "ask-always",
  fileAccess: true,
  shellAccess: true,
  networkAccess: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function PermissionsSettings() {
  const [yoloMode, setYoloMode] = useState(MOCK.yoloMode);
  const [approvalPolicy, setApprovalPolicy] = useState(MOCK.approvalPolicy);
  const [fileAccess, setFileAccess] = useState(MOCK.fileAccess);
  const [shellAccess, setShellAccess] = useState(MOCK.shellAccess);
  const [networkAccess, setNetworkAccess] = useState(MOCK.networkAccess);

  const id = useId();
  const yoloId = `${id}-yolo`;
  const policyId = `${id}-policy`;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        // TODO: persist settings
      }}
    >
      {/* Yolo mode */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
        <div className="flex gap-2.5">
          <ZapIcon className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <label htmlFor={yoloId} className="text-xs font-medium text-foreground">
                Yolo mode
              </label>
              {yoloMode && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-500 border-amber-500/30"
                >
                  active
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Auto-approve all tool calls without asking.
            </p>
          </div>
        </div>
        <Switch
          id={yoloId}
          size="sm"
          checked={yoloMode}
          onCheckedChange={setYoloMode}
        />
      </div>

      {/* Approval policy */}
      <Field label="Approval policy" htmlFor={policyId} hint={yoloMode ? "Disabled while yolo mode is active." : undefined}>
        <Select
          value={approvalPolicy}
          onValueChange={setApprovalPolicy}
          disabled={yoloMode}
        >
          <SelectTrigger id={policyId} size="sm" className="max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask-always">Always ask</SelectItem>
            <SelectItem value="auto-safe">Auto-approve safe tools</SelectItem>
            <SelectItem value="auto-all">Auto-approve all</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <hr className="border-border" />

      {/* Tool access */}
      <fieldset className="space-y-1" disabled={yoloMode}>
        <legend className="text-xs font-medium text-foreground mb-2">Tool access</legend>
        <PermissionToggle
          icon={FolderIcon}
          label="File system"
          description="Read and write files on disk"
          checked={fileAccess}
          onCheckedChange={setFileAccess}
        />
        <PermissionToggle
          icon={TerminalIcon}
          label="Shell access"
          description="Execute shell commands"
          checked={shellAccess}
          onCheckedChange={setShellAccess}
        />
        <PermissionToggle
          icon={GlobeIcon}
          label="Network access"
          description="Make outbound HTTP requests"
          checked={networkAccess}
          onCheckedChange={setNetworkAccess}
        />
      </fieldset>

      {/* Hint */}
      <div className="flex gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
        <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Permissions are enforced per-workspace. When yolo mode is active, all
          tool calls are auto-approved regardless of individual toggles.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function PermissionToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof FolderIcon;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  const toggleId = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex gap-2.5">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <div className="space-y-0.5">
          <label htmlFor={toggleId} className="text-xs font-medium text-foreground">
            {label}
          </label>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        id={toggleId}
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
