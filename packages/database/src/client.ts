import { drizzle } from "drizzle-orm/better-sqlite3";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import * as schema from "./schema.js";

const HATCH_HOME = process.env.HATCH_HOME ?? join(homedir(), ".hatch");
const HATCH_DB_DIR = join(HATCH_HOME, ".db");
mkdirSync(HATCH_DB_DIR, { recursive: true });

export const db = drizzle(process.env.DATABASE_URL ?? join(HATCH_DB_DIR, "hatch.db"), { schema });

export type Database = typeof db;
