import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';
import type { Harness } from '@hatch/harness';

interface ModeInfo {
  id: string;
  name: string;
}

/**
 * Creates the switch_mode tool bound to a harness instance via lazy ref.
 * Only useful when a workspace has 2+ modes.
 */
export function createModeTools(
  harnessRef: { current: Harness | null },
  modes: ModeInfo[],
) {
  const modeList = modes.map((m) => `${m.id} (${m.name})`).join(', ');
  const modeIds = modes.map((m) => m.id);

  const switch_mode = createTool({
    id: 'switch_mode',
    description: `Switch the current operating mode. Available modes: ${modeList}. Switching aborts the current generation and restarts with the new mode's instructions.`,
    inputSchema: z.object({
      label: z.string().min(1).describe('Short action label shown to the user (e.g. "Switching to Plan mode"). Use present progressive (–ing) form.'),
      modeId: z.string().min(1).describe(`The mode to switch to. One of: ${modeIds.join(', ')}`),
    }),
    execute: async ({ modeId }, context) => {
      const harness = harnessRef.current;
      if (!harness) return { error: 'Mode switch not available' };

      if (!modeIds.includes(modeId)) {
        return { error: `Invalid mode: ${modeId}. Available: ${modeIds.join(', ')}` };
      }

      await harness.switchMode({ modeId, requestContext: (context as any)?.requestContext });
      return { switched: true, modeId };
    },
  });

  return { switch_mode };
}
