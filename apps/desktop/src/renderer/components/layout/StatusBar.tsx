import { useUIStore } from '../../stores/ui-store.js';
import { useGatewayHealth } from '../../hooks/use-gateway-health.js';

export function StatusBar() {
  const gatewayUrl = useUIStore((s) => s.gatewayUrl);
  const { data, isSuccess, isError } = useGatewayHealth();

  const connected = isSuccess && data?.status === 'ok';

  return (
    <div className="h-6 bg-card border-t border-border flex items-center px-3 text-[11px] text-muted-foreground gap-4">
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            connected
              ? 'bg-success'
              : isError
                ? 'bg-destructive'
                : 'bg-muted-foreground/30'
          }`}
        />
        {connected ? 'Connected' : isError ? 'Disconnected' : 'Connecting...'}
      </span>
      {gatewayUrl && <span className="text-muted-foreground/40">{gatewayUrl}</span>}
      {connected && data?.version && (
        <span className="text-muted-foreground/40">v{data.version}</span>
      )}
    </div>
  );
}
