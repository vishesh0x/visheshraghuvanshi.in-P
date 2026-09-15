import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    // Source maps leak original file paths/source and make it trivial to
    // reconstruct app internals from a production bundle - keep them off
    // for every build target. Re-enable locally with `vite build --sourcemap`
    // if you need to debug a production-only issue.
    sourcemap: false,
  },
  environments: {
    // Scoped to just the client (browser) bundle - this is the one
    // visitors actually download, so it's the one worth splitting.
    // Setting manualChunks at the top-level `build` key instead applies it
    // to every build phase, including Nitro's own Worker bundling, which
    // sets its own conflicting `codeSplitting` output option and just
    // produces harmless "option is ignored" warnings during that phase for
    // no benefit (nobody downloads the Worker script, so splitting it into
    // named chunks doesn't help anyone).
    client: {
      build: {
        rollupOptions: {
          output: {
            // Split the heaviest, rarely-co-loaded dependencies into their
            // own chunks so a visitor to the public site never downloads
            // the admin dashboard's editor/chart/drag-and-drop libraries,
            // and vice versa.
            manualChunks(id) {
              if (!id.includes("node_modules")) return undefined;
              if (id.includes("@tiptap") || id.includes("prosemirror")) return "editor";
              if (id.includes("recharts") || id.includes("d3-")) return "charts";
              if (id.includes("@dnd-kit")) return "dnd";
              if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router-core")) {
                return "router";
              }
              return undefined;
            },
          },
        },
      },
    },
  },
  plugins: [
    tanstackStart({
      server: {
        entry: "src/server.ts",
      },
    }),
    nitro({
      preset: "cloudflare-module",
      // Nitro doesn't inherit compatibility_date from the project's own
      // wrangler.json - left unset, it silently stamps whatever day the
      // build happens to run into .output/server/wrangler.json, which is
      // the config actually used for `wrangler deploy`. That means the
      // "pin" in the root wrangler.json below was never taking effect,
      // and every deploy quietly ran on a different Workers runtime
      // compatibility date. Pinning it here to the date this exact stack
      // was last verified working stops that drift.
      compatibilityDate: "2026-09-04",
    }),
    tailwindcss(),
    react(),
  ],
});