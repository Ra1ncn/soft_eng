import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "server/prisma/schema.prisma",
  migrations: {
    path: "server/prisma/migrations",
    seed: "tsx server/prisma/seed.ts",
  },
  datasource: { url: env("DATABASE_URL") },
});
