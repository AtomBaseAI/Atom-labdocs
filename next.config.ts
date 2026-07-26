import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: "output: standalone" is removed for Vercel deployment.
  // Vercel handles its own serverless output format; "standalone" is
  // only needed for self-hosted / Docker deployments.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-77377d4a-af65-4a26-a731-42f39008f43b.space-z.ai',
  ],
};

export default nextConfig;
