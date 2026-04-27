import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Baileys uses dynamic CJS requires and platform-native protobuf code
  // that Next's webpack/turbopack bundler can't trace correctly. Keeping
  // it "external" means Node resolves it from `node_modules` at runtime,
  // which is what the standalone build expects.
  serverExternalPackages: ["@whiskeysockets/baileys", "qrcode"],
};

export default nextConfig;
