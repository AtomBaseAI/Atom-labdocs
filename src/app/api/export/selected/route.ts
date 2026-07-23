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
} from "@/lib/import-export";

// POST /api/export/selected
// Body: { courseGroupIds?: string[], courseIds?: string[], labIds?: string[], moduleIds?: string[] }
//
// Exports a selective JSON dump containing only the requested items (with
// parent context included automatically so the file remains self-contained).
//
// Selection resolution:
//   - Selected group  → include group + all its courses / labs / modules
//   - Selected course → include course + all its labs / modules (+ its group)
//   - Selected lab    → include lab + all its modules (+ its course + group)
//   - Selected module → include module (+ its lab + course + group)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const courseGroupIds: string[] = Array.isArray(o.courseGroupIds) ? o.courseGroupIds : [];
  const courseIds: string[] = Array.isArray(o.courseIds) ? o.courseIds : [];
  const labIds: string[] = Array.isArray(o.labIds) ? o.labIds : [];
  const moduleIds: string[] = Array.isArray(o.moduleIds) ? o.moduleIds : [];

  if (
    courseGroupIds.length === 0 &&
    courseIds.length === 0 &&
    labIds.length === 0 &&
    moduleIds.length === 0
  ) {
    return NextResponse.json(
      { error: "No items selected for export." },
      { status: 400 }
    );
  }

  // Build mutable sets for resolution
  const selGroups = new Set(courseGroupIds);
  const selCourses = new Set(courseIds);
  const selLabs = new Set(labIds);
  const selModules = new Set(moduleIds);

  // Fetch everything — the dataset is small (a lab-docs site), so loading
  // the full tree into memory is fine and keeps the filtering logic simple.
  const [allGroups, allCourses] = await Promise.all([
    db.courseGroup.findMany({ orderBy: { order: "asc" } }),
    db.course.findMany({
      orderBy: { order: "asc" },
      include: {
        group: true,
        labs: {
          orderBy: { order: "asc" },
          include: {
            modules: {
              orderBy: { order: "asc" },
              include: { steps: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    }),
  ]);

  // --- Resolution pass 1: selected groups → cascade to courses ---
  for (const g of allGroups) {
    if (selGroups.has(g.id)) {
      for (const c of allCourses) {
        if (c.groupId === g.id) selCourses.add(c.id);
      }
    }
  }

  // --- Resolution pass 2: selected courses → cascade to labs ---
  for (const c of allCourses) {
    if (selCourses.has(c.id)) {
      for (const l of c.labs) selLabs.add(l.id);
    }
  }

  // --- Resolution pass 3: selected labs → cascade to modules ---
  for (const c of allCourses) {
    for (const l of c.labs) {
      if (selLabs.has(l.id)) {
        for (const m of l.modules) selModules.add(m.id);
      }
    }
  }

  // --- Back-propagation: ensure parent context is included ---
  // Modules → labs
  for (const c of allCourses) {
    for (const l of c.labs) {
      if (l.modules.some((m) => selModules.has(m.id))) {
        selLabs.add(l.id);
      }
    }
  }
  // Labs → courses
  for (const c of allCourses) {
    if (c.labs.some((l) => selLabs.has(l.id))) {
      selCourses.add(c.id);
    }
  }
  // Courses → groups
  for (const c of allCourses) {
    if (selCourses.has(c.id) && c.groupId) {
      selGroups.add(c.groupId);
    }
  }

  // --- Serialize ---
  const includedGroups = allGroups
    .filter((g) => selGroups.has(g.id))
    .map((g) => serializeCourseGroup(g));

  const includedCourses = allCourses
    .filter((c) => selCourses.has(c.id))
    .map((c) =>
      serializeCourse(
        {
          title: c.title,
          description: c.description,
          icon: c.icon,
          color: c.color,
          order: c.order,
          hidden: c.hidden,
          labs: c.labs
            .filter((l) => selLabs.has(l.id))
            .map((l) =>
              serializeLab({
                title: l.title,
                description: l.description,
                order: l.order,
                hidden: l.hidden,
                linkType: l.linkType,
                linkUrl: l.linkUrl,
                modules: l.modules
                  .filter((m) => selModules.has(m.id))
                  .map((m) =>
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

  const payload = {
    version: EXPORT_VERSION,
    source: EXPORT_SOURCE,
    exportedAt: new Date().toISOString(),
    type: "full",
    courseGroups: includedGroups,
    courses: includedCourses,
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="atom-labdocs-selected-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
