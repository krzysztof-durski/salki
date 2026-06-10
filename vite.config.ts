import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { readFileSync } from "fs";

function loadDevVars(): Record<string, string> {
  try {
    const content = readFileSync(".dev.vars", "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx > 0) {
          vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
        }
      }
    }
    return vars;
  } catch {
    return {};
  }
}

export default defineConfig({
  plugins: [
    cloudflareDevProxy({
      // getPlatformProxy does not reliably inject .dev.vars plain vars in all React Router versions.
      // Read them explicitly and merge into env so server-side code receives them.
      getLoadContext({ context }) {
        const devVars = loadDevVars();
        return {
          ...context,
          cloudflare: {
            ...context.cloudflare,
            // devVars first so real bindings (DB) take priority
            env: { ...devVars, ...context.cloudflare.env } as CloudflareEnv,
          },
        };
      },
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
