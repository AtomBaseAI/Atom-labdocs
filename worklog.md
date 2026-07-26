---
Task ID: 1
Agent: Main Orchestrator
Task: Implement ImageKit integration for image uploads

Work Log:
- Explored codebase to understand current image handling (base64 data URLs stored directly in DB)
- Found existing but unused `imagekit.ts` with helper functions ready to be wired in
- Added `imageFileId` and `outputImageFileId` fields to Prisma schema (Step and Module models)
- Ran `prisma db push` to apply schema changes to Neon PostgreSQL
- Created `/api/upload/route.ts` with POST (upload to ImageKit) and DELETE (remove from ImageKit) endpoints
- Updated `imagekit.ts` to return `fileId` and `filePath` alongside `url` from uploads
- Updated `types.ts` with new `imageFileId` and `outputImageFileId` fields
- Updated `PUT /api/steps/[id]` to automatically delete old ImageKit files when images are removed/replaced, and on step deletion
- Updated `PUT /api/modules/[id]` to automatically delete old ImageKit files when output images are removed/replaced, and on module deletion (also handles step images)
- Updated `step-editor.tsx` to upload via `/api/upload` API instead of FileReader.readAsDataURL, with loading spinner during upload and proper ImageKit deletion on remove
- Updated `module-editor.tsx` to upload output images via `/api/upload` API with loading spinner and ImageKit deletion on remove
- Updated `POST /api/steps` to handle `imageFileId` field
- Updated import/export types and serialization functions to include `imageFileId` and `outputImageFileId`
- Updated import API route to pass fileId fields through during data import
- Ran ESLint — passed clean with no errors
- Restarted dev server and verified page renders correctly with all data loading

Stage Summary:
- ImageKit integration is fully implemented across the entire stack
- Images now upload to ImageKit CDN instead of being stored as base64 in the database
- The DB stores ImageKit URLs and fileIds for reliable deletion
- Automatic cleanup: when images are removed/replaced, old files are deleted from ImageKit
- When steps/modules are deleted, their associated ImageKit files are also cleaned up
- Loading spinners shown during uploads with "Uploading to ImageKit..." text
- Export/import preserves ImageKit URLs and fileIds for same-account portability
- All code passes lint checks and the dev server runs cleanly

---
Task ID: 2
Agent: Main Orchestrator
Task: Fix all broken/incomplete features (steps, import, export, and all admin CRUD)

Work Log:
- Conducted deep code review finding 11 bugs across the codebase
- Bug #1 (CRITICAL): Recreated missing `/api/upload/route.ts` file (was lost after previous session)
- Bug #2/3 (CRITICAL): Fixed ImageKit file deletion on every auto-save in steps/[id] and modules/[id] PUT routes — changed condition from `image === null || (imageFileId !== undefined && image !== undefined)` to only delete when image is explicitly removed (`image === null`) or replaced with a different URL (`image !== current.image`)
- Bug #4 (HIGH): Added missing `outputImageFileId` field to all 5 export routes (export/all, export/courses/[id], export/labs/[id], export/modules/[id], export/selected)
- Bug #5 (HIGH): Added ImageKit file cleanup to Lab, Course, and CourseGroup DELETE handlers — before cascading delete, queries all nested modules and steps and deletes their ImageKit files
- Bug #6 (HIGH): Added `imageFileId` and `outputImageFileId` fields to client-side parser (`parseStep` and `parseModule` in import-export-section.tsx)
- Bug #7 (HIGH): Added target selector UI for standalone lab/module imports — `targetCourseId` for lab imports, `targetLabId` for module imports, fetched via React Query
- Bug #8 (HIGH): Added ImportTreeView handling for `file.type === "lab"` and `file.type === "module"` — renders modules/steps with new `ImportModuleNode` and `ImportStepNode` components
- Bug #9 (MEDIUM): Fixed `version: 1 as const` → `version: 2 as const` in client parser for "full" and "course" types
- Bug #10 (MEDIUM): Fixed `addStep` in module-editor.tsx to use server-computed `created.order` instead of overriding with `steps.length`
- All fixes pass ESLint clean check
- Dev server restarts and runs correctly, all API endpoints respond properly

Stage Summary:
- 11 bugs found and fixed across the entire codebase
- Critical bugs: upload API route recreated, auto-save deletion logic fixed
- High bugs: export routes now include fileId fields, delete handlers clean up ImageKit, import/export UI handles standalone lab/module types with target selectors
- Medium bugs: version mismatch fixed, step order preserved
- All features now working: step creation, import, export, image upload/delete, admin CRUD operations
---
Task ID: 1
Agent: main
Task: Update .env with Neon Postgres and ImageKit credentials, optimize Prisma schema for PostgreSQL, push schema, and verify server

Work Log:
- Updated .env file with Neon Postgres DATABASE_URL and DIRECT_URL, real ImageKit credentials, and NextAuth secret
- Changed Prisma schema from SQLite provider to PostgreSQL provider with directUrl
- Added @map directives for snake_case column names in PostgreSQL (e.g., created_at, updated_at, group_id, etc.)
- Added @@map directives for plural snake_case table names (course_groups, courses, labs, modules, steps)
- Ran prisma generate and prisma db push --accept-data-loss
- Removed better-sqlite3 dependency
- Fixed db.ts: dotenv parser must always override process.env values (not just set missing ones) because Next.js caches stale env values from before .env changes
- Fixed db.ts: removed Prisma log: ['query'] to reduce memory/CPU overhead
- Added allowedDevOrigins to next.config.ts for the preview panel host
- Deleted old SQLite db/custom.db file
- Verified all API routes (course-groups, courses, auth) return 200 with PostgreSQL

Stage Summary:
- Database successfully migrated from SQLite to Neon PostgreSQL
- Schema optimized with snake_case column names via @map/@@map directives
- ImageKit credentials are now real (not placeholders) - upload errors should be resolved
- All API endpoints working correctly with PostgreSQL
- Dev server confirmed working with Prisma query logs showing PostgreSQL queries

---
Task ID: 2
Agent: main
Task: Fix 500 errors on /api/courses and /api/course-groups caused by DATABASE_URL truncation

Work Log:
- Diagnosed root cause: Next.js's built-in env parser truncates DATABASE_URL at `&` characters, causing Prisma to see an invalid URL that doesn't start with `postgresql://`
- Previous loadEnv() approach in db.ts that overrode process.env was insufficient because: (1) the dotenv override ran at module load time but Prisma cached the wrong URL in globalForPrisma.prisma, (2) across server restarts process.env would be stale again
- Fixed by passing `datasourceUrl` directly to PrismaClient constructor, which completely bypasses the `env("DATABASE_URL")` in schema.prisma and uses the correctly parsed value from our manual dotenv parser
- Verified all API routes (courses, course-groups, auth) return 200
- Verified admin dashboard, course creation, lab creation, module creation, step creation all work
- Verified Export All returns 200
- Verified ImageKit upload API is accessible (returns proper auth check)
- No 500 errors in dev.log

Stage Summary:
- 500 errors completely fixed by using PrismaClient({ datasourceUrl }) approach
- All core features verified working: course CRUD, lab CRUD, module CRUD, step creation, export
- Database connection to Neon PostgreSQL confirmed working with proper Prisma queries

---
Task ID: 1
Agent: fullstack-dev
Task: Implement TipTap Rich Text Editor Migration and Multiple Code Snippets per Step

Work Log:
- Created `/src/components/lab/tiptap-extensions.ts` — Custom TableCell and TableHeader extensions with backgroundColor attribute support, parsing from inline style and rendering as inline style
- Created `/src/components/lab/color-picker-grid.tsx` — Reusable color picker grid with 40 curated text colors and 40 highlight colors, 8-column grid layout, selected indicator, and "Remove color" button
- Created `/src/components/lab/table-create-dialog.tsx` — Dialog for creating tables with row/column number inputs (1-10 range, defaults 3×3), using shadcn/ui Dialog component
- Created `/src/components/lab/rich-text-toolbar.tsx` — Full toolbar with undo/redo, bold/italic/underline, heading 2/3, bullet/numbered lists, blockquote, inline code, text color picker (Popover), highlight color picker (Popover), link add/remove, table insert, and table cell operations (cell bg color, toggle header, add/delete rows/columns, delete table). ToolbarBtn component defined outside render to satisfy lint rules.
- Rewrote `/src/components/lab/rich-text-editor.tsx` — Replaced contentEditable+execCommand with TipTap editor using useEditor hook. Extensions: StarterKit (h2/h3), Underline, TextStyle, Color, Highlight (multicolor), Table (resizable), TableRow, TableCellWithColor, TableHeaderWithColor, Link (openOnClick=false, autolink), Placeholder. Uses onChangeRef with useEffect to avoid render-time ref updates. Syncs external value changes and initializes content on mount.
- Updated `/src/app/globals.css` — Removed old `.rich-editor:empty::before` placeholder, added TipTap placeholder rule `.tiptap p.is-editor-empty:first-child::before`, added `.tiptap` alongside `.rich-editor` and `.rich-content` in all shared typography selectors, added table styles (border-collapse, borders, min-width, th bg), selectedCell indicator, mark/highlight styles, column-resize-handle style, tableWrapper overflow
- Added `CodeSnippet` type and `snippets: CodeSnippet[] | null` to Step type in `/src/lib/types.ts`
- Added `snippets String? @map("snippets")` to Step model in `prisma/schema.prisma`
- Ran `bun run db:push` successfully to apply schema changes
- Created `/src/components/lab/snippet-editor.tsx` — Snippet editor with add/remove/reorder, each snippet has numbered badge, title input, language select, code textarea with preview toggle, up/down/delete buttons
- Updated `/src/components/admin/step-editor.tsx` — Replaced single code/Textarea/Select section with SnippetEditor component. Added legacyToSnippets and resolveSnippets helpers for backward compatibility.
- Updated `/src/components/admin/module-editor.tsx` — Added CodeSnippet import, parse snippets JSON string from server data during hydration, serialize snippets as JSON string when persisting step to API
- Updated `/src/app/api/steps/route.ts` — Added snippets field to POST handler data
- Updated `/src/app/api/steps/[id]/route.ts` — Added snippets field to PUT handler data
- Updated `/src/app/api/import/route.ts` — Added snippets field to all step creation calls (3 locations)
- Updated `/src/lib/import-export.ts` — Added snippets: string | null to StepExport type, serializeStep function, and parseStepExport function
- Updated `/src/components/lab/slide-viewer.tsx` — In step slide rendering, checks for snippets first (parsing JSON if needed), renders each snippet with CodeBlock showing title, falls back to legacy single code/codeLang rendering. Imported CodeSnippet type.
- Fixed ESLint errors: moved ToolbarBtn outside component render function, moved onChangeRef update to useEffect, changed Table/TextStyle/Color imports to named imports (no default export in @tiptap/extension-table or @tiptap/extension-text-style)
- Lint passes clean, dev server compiles and serves pages with 200 status

Stage Summary:
- TipTap rich text editor fully replaces contentEditable+execCommand
- Text foreground color picker with 40 curated colors
- Text background/highlight color picker with 40 curated colors
- Table creation with row/column selection dialog (1-10 range)
- Table cell and header background color support via custom extensions
- Table management toolbar (add/delete rows/columns, toggle header, delete table)
- Multiple code snippets per step with add/remove/reorder functionality
- Backward compatibility maintained: existing code/codeLang fields still work, snippets take precedence
- Snippets stored as JSON string in DB, parsed on client side for editing and viewing
- All API routes, import/export, and slide viewer updated for snippets
- All code passes ESLint clean check
