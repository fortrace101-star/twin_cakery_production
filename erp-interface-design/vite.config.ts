import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // Windows/Node 18+ can bind `localhost` to IPv6 (::1) only, which makes
    // Chrome's IPv4 (127.0.0.1) requests + HMR WebSocket fail with
    // ERR_CONNECTION_REFUSED. `host: true` listens on all stacks so both work.
    host: true,
    // Proxy API calls to the Express server (server/index.ts) during development.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});

