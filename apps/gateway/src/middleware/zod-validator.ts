import { validator } from 'hono/validator';
import type { z } from 'zod/v4';

export const zValidator = <T extends z.ZodType>(
  target: 'json',
  schema: T,
) =>
  validator(target, async (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
    }
    return result.data as z.infer<T>;
  });
