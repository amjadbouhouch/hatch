import { useQuery } from '@tanstack/react-query';
import { getClient } from '../client/api.js';
import { useUIStore } from '../stores/ui-store.js';

export function useGatewayHealth() {
  const gatewayUrl = useUIStore((s) => s.gatewayUrl);

  return useQuery({
    queryKey: ['gateway', 'health'],
    queryFn: async () => {
      const api = await getClient();
      const res = await api.health.$get();
      return res.json();
    },
    enabled: !!gatewayUrl,
    refetchInterval: 15_000,
    retry: false,
  });
}
