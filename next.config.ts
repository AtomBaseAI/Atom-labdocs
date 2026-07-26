import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-77377d4a-af65-4a26-a731-42f39008f43b.space-z.ai',
  ],
};

export default nextConfig;
