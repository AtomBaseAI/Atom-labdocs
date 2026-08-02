import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  EXPORT_SOURCE,
  EXPORT_VERSION,
  serializeModule,
  serializeStep,
  type ExportFile,
} from "@/lib/import-export";

// GET /api/export/modules/[id]
// Returns a single module (with its steps) as a standalone JSON dump.
// No parent references (no lab/course/group).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const mod = await db.module.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
    },
  });

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const moduleExport = serializeModule({
    title: mod.title,
    explanation: mod.explanation,
    overview: mod.overview,
    flow: mod.flow,
    output: mod.output,
    outputCode: mod.outputCode,
    outputCodeLang: mod.outputCodeLang,
    outputImage: mod.outputImage,
    outputImageFileId: mod.outputImageFileId,
    outputImageCaption: mod.outputImageCaption,
    order: mod.order,
    hidden: mod.hidden,
    locked: mod.locked,
    steps: mod.steps.map((s) => serializeStep(s)),
  });

  const payload: ExportFile = {
    version: EXPORT_VERSION,
    source: EXPORT_SOURCE,
    exportedAt: new Date().toISOString(),
    type: "module",
    module: moduleExport,
  };

  const slug = mod.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "module";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atom-labdocs-module-${slug}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
