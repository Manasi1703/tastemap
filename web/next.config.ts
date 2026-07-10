import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@xenova/transformers", "sharp", "onnxruntime-node"],
};

export default nextConfig;
