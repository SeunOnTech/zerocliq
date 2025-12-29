import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pino', 'pino-pretty'],
  transpilePackages: ['@solana/web3.js', '@coral-xyz/anchor', 'jito-ts'],
  turbopack: {
    resolveAlias: {
      'tap': './src/lib/mock-module.js',
      'tape': './src/lib/mock-module.js',
      'why-is-node-running': './src/lib/mock-module.js',
      'pino-elasticsearch': './src/lib/mock-module.js',
      'desm': './src/lib/mock-module.js',
      'fastbench': './src/lib/mock-module.js',
      'thread-stream': './src/lib/mock-module.js',
    },
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    // Ignore test runners and server-side specific modules causing issues in browser builds
    config.resolve.alias = {
      ...config.resolve.alias,
      tap: false,
      tape: false,
      'why-is-node-running': false,
      'pino-elasticsearch': false,
      desm: false,
      fastbench: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
