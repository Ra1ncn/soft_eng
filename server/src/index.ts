import { app } from "./app.ts";
import { prisma } from "./lib/prisma.ts";

const port = Number(process.env.SERVER_PORT || 3001);
const server = app.listen(port, "127.0.0.1", () => console.log(`API: http://localhost:${port}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  }));
}
