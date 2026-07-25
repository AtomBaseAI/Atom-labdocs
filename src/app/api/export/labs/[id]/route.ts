import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  EXPORT_SOURCE,
  EXPORT_VERSION,
  serializeLab,
  serializeModule,
  serializeStep,
  type ExportFile,
} from "@/lib/import-export";

// GET /api/export/labs/[id]
// Returns a single lab (with its modules and steps) as a standalone JSON dump.
// No parent references (no course/group).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const lab = await db.lab.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          steps: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!lab) {
    return NextResponse.json({ error: "Lab not found" }, { status: 404 });
  }

  const labExport = serializeLab({
    title: lab.title,
    description: lab.description,
    order: lab.order,
    hidden: lab.hidden,
    linkType: lab.linkType,
    linkUrl: lab.linkUrl,
    modules: lab.modules.map((m) =>
      serializeModule({
        title: m.title,
        explanation: m.explanation,
        overview: m.overview,
        flow: m.flow,
        output: m.output,
        outputCode: m.outputCode,
        outputCodeLang: m.outputCodeLang,
        outputImage: m.outputImage,
        outputImageFileId: m.outputImageFileId,
        outputImageCaption: m.outputImageCaption,
        order: m.order,
        hidden: m.hidden,
        steps: m.steps.map((s) => serializeStep(s)),
      })
    ),
  });

  const payload: ExportFile = {
    version: EXPORT_VERSION,
    source: EXPORT_SOURCE,
    exportedAt: new Date().toISOString(),
    type: "lab",
    lab: labExport,
  };

  const slug = lab.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "lab";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atom-labdocs-lab-${slug}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
