import { NextResponse } from "next/server";
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

// GET /api/export/all
// Returns the entire content tree (all course groups + all courses with nested
// labs/modules/steps) as a single JSON dump. Admin-only so public visitors
// can't scrape hidden content.
//
// The response is a `ExportFile` of type "full". We never include DB ids or
// timestamps — only the portable content fields — so re-importing creates
// fresh rows without colliding with existing data.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull everything in one parallel batch. The dataset is small (a lab docs
  // site), so loading it all into memory is fine and keeps the serializer
  // simple.
  const [groups, courses] = await Promise.all([
    db.courseGroup.findMany({
      orderBy: { order: "asc" },
    }),
    db.course.findMany({
      orderBy: { order: "asc" },
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
    }),
  ]);

  const courseGroups = groups.map((g) => serializeCourseGroup(g));
  const coursesExport = courses.map((c) =>
    serializeCourse(
      {
        title: c.title,
        description: c.description,
        icon: c.icon,
        color: c.color,
        order: c.order,
        hidden: c.hidden,
        labs: c.labs.map((l) =>
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
      c.group?.name ?? null
    )
  );

  const payload: ExportFile = {
    version: EXPORT_VERSION,
    source: EXPORT_SOURCE,
    exportedAt: new Date().toISOString(),
    type: "full",
    courseGroups,
    courses: coursesExport,
  };

  // Stream-friendly JSON. We use a stable-ish filename so downloads from the
  // admin panel look sensible.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atom-labdocs-full-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
