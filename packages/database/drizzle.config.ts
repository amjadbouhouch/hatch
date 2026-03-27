import { defineConfig } from "drizzle-kit";
import { homedir } from "node:os";
import { join } from "node:path";

const HATCH_HOME = process.env.HATCH_HOME ?? join(homedir(), ".hatch");
const HATCH_DB_DIR = join(HATCH_HOME, ".db");

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? join(HATCH_DB_DIR, "hatch.db"),
  },
});
