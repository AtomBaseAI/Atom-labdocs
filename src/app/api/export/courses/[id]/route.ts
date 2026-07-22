import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  EXPORT_SOURCE,
  EXPORT_VERSION,
  serializeCourse,
  serializeCourseGroup,
  serializeLab,
  serializeModule,
  serializeStep,
  type ExportFile,
} from "@/lib/import-export";

// GET /api/export/courses/[id]
// Returns a single course (including its labs/modules/steps and, optionally,
// its parent course group) as a JSON dump. Admin-only.
//
// The response is a `ExportFile` of type "course". Like the full export, it
// carries no DB ids — re-importing always creates a fresh course.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      group: true,
      labs: {
        orderBy: { order: "asc" },
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: {
              steps: { orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const groupExport = course.group
    ? serializeCourseGroup(course.group)
    : null;

  const courseExport = serializeCourse(
    {
      title: course.title,
      description: course.description,
      icon: course.icon,
      color: course.color,
      order: course.order,
      hidden: course.hidden,
      labs: course.labs.map((l) =>
        serializeLab({
          title: l.title,
          description: l.description,
          order: l.order,
          hidden: l.hidden,
          linkType: l.linkType,
          linkUrl: l.linkUrl,
          modules: l.modules.map((m) =>
            serializeModule({
              title: m.title,
              explanation: m.explanation,
              overview: m.overview,
              flow: m.flow,
              output: m.output,
              conclusion: m.conclusion,
              order: m.order,
              hidden: m.hidden,
              steps: m.steps.map((s) => serializeStep(s)),
            })
          ),
        })
      ),
    },
    course.group?.name ?? null
  );

  const payload: ExportFile = {
    version: EXPORT_VERSION,
    source: EXPORT_SOURCE,
    exportedAt: new Date().toISOString(),
    type: "course",
    course: courseExport,
    group: groupExport,
  };

  // Slugify the title for a friendly download filename.
  const slug = course.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "course";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atom-labdocs-${slug}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
