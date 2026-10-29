import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Vite mints a fresh random HMR WebSocket token on every dev-server start,
// so an already-open tab keeps failing `?token=...` upgrades (HTTP 400 →
// "[vite] failed to connect to websocket") until it is manually reloaded.
// Pin the token to a per-machine value: seeded once from the currently open
// dev tab's client (its token appears in the browser console — it is not
// sensitive), then persisted in .vite-ws-token for every restart after.
const WS_TOKEN_FILE = path.resolve(__dirname, ".vite-ws-token");

function currentWsToken(): string {
  const stored = existsSync(WS_TOKEN_FILE) ? readFileSync(WS_TOKEN_FILE, "utf8").trim() : "";
  if (stored) return stored;
  const seeded = "skBnJNgLteUj";
  writeFileSync(WS_TOKEN_FILE, seeded);
  return seeded;
}

// The ws upgrade guard reads config.webSocketToken at upgrade time, which is
// after configResolved hooks run — so writing the resolved field here sticks.
const stableWsToken: Plugin = {
  name: "stable-ws-token",
  configResolved(config) {
    config.webSocketToken = currentWsToken();
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), stableWsToken],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rolldownOptions: {
      output: {
        // Split the single 630 kB index bundle: vendor libraries get their own
        // cacheable chunks (app code iterates far more often than deps).
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: "radix-ui", test: /node_modules[\\/]@(radix-ui|lucide)[\\/]/, priority: 20 },
            { name: "vendor", test: /node_modules/, priority: 10 },
          ],
        },
      },
    },
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

