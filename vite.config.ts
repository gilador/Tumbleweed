import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import pkg from "./package.json" with { type: "json" };

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    APP_VERSION: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Tumbleweed",
        short_name: "Tumbleweed",
        description: "Shift scheduling manager",
        theme_color: "#1e293b",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/tumbleweed/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "/tumbleweed/",
  build: {
    outDir: "dist/tumbleweed",
    emptyOutDir: true,
  },
  server: {
    port: 5273,
    host: true,
  },
}));
