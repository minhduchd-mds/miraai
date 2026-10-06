import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  preview: {
    buckets: {
      uploads: { access: "private" },
      assets: { access: "private" },
    },
    functions: {
      miratts: { name: "miratts", source: "./functions/miratts/index.mjs" },
    },
  },
});
