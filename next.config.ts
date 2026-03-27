import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {}, // silence Turbopack/webpack conflict warning in Next.js 16
  webpack: (config) => {
    // jsPDF bundles fflate's Node.js build; alias to the browser ES build
    config.resolve.alias["fflate/lib/node.cjs"] = path.resolve(
      "./node_modules/fflate/esm/browser.js"
    );
    return config;
  },
};

export default nextConfig;
