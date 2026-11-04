import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const env = loadEnv(mode, root, "");
  return {
    envDir: root,
    server: {
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      proxy: { "/api": env.VITE_API_TARGET || "http://localhost:3001" },
    },
  };
});
