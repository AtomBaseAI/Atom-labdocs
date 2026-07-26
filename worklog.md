---
Task ID: 1
Agent: main
Task: Make app Vercel-compatible as a single application deployment

Work Log:
- Analyzed all Vercel compatibility issues in the project
- Removed `output: "standalone"` from next.config.ts (only needed for Docker/self-hosting, not Vercel)
- Removed `serverExternalPackages: ["child_process"]` (no longer needed since execFile is removed)
- Rewrote PDF route (`src/app/api/modules/[id]/pdf/route.ts`) to return styled HTML directly instead of spawning child process with execFile. Added a "Print / Save as PDF" overlay bar in the HTML. This eliminates the Turbopack build error and makes PDF generation Vercel-compatible
- Fixed `src/lib/db.ts` — removed readFileSync + dotenv parsing, now uses process.env.DATABASE_URL directly (Vercel sets env vars via dashboard, not .env files)
- Updated `src/components/admin/admin-view.tsx` — DownloadPdfButton now uses window.open() to open HTML in new tab for browser Print-to-PDF, instead of fetching a blob
- Updated package.json build script: removed standalone cp commands, simplified to just "next build"
- Updated package.json start script: changed from standalone server.js to "next start -p 3000"
- Added "postinstall": "prisma generate" to package.json for Vercel build pipeline
- Lint passes clean, no errors
- Agent Browser verification confirms app works correctly: homepage loads, public/admin views work, PDF button present, responsive layout OK

Stage Summary:
- All Vercel-incompatible patterns removed: execFile, child_process, readFileSync .env, output:standalone
- PDF generation now uses browser Print-to-PDF approach (works on any platform including Vercel serverless)
- Database connection uses process.env directly (works with Vercel env vars dashboard)
- Build pipeline includes prisma generate via postinstall hook
- App verified working correctly with Agent Browser
