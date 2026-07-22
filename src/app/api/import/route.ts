import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  parseExportFile,
  type CourseExport,
  type CourseGroupExport,
  type ExportFile,
} from "@/lib/import-export";

// POST /api/import
// Body: { file: ExportFile, options?: { duplicateGroups?: boolean } }
//   - file:        the parsed ExportFile JSON (full dump or single course)
//   - options:     optional behaviour tweaks (see below)
//
// Behaviour:
//   - Admin-only.
//   - NEVER updates or deletes existing rows. Imports only create new rows.
//   - Course groups are matched by NAME:
//       * If a group with the same name exists, courses are attached to it.
//       * Otherwise the group is created (preserving icon/color/description).
//       * `options.duplicateGroups=true` forces creation of new groups even
//         when a same-named one exists (useful for "copy to a fresh group").
//   - Courses are always created with NEW cuids, even if a same-titled course
//     already exists. This is intentional — import is "copy in", not "sync".
//   - All nested labs/modules/steps are created in the right order with their
//     own new cuids, preserving order/hidden/rich-text/flow fields verbatim.
//
// Returns: { ok: true, created: { courseGroups, courses, labs, modules, steps } }
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
  const fileRaw = o.file;
  const options =
    o.options && typeof o.options === "object"
      ? (o.options as { duplicateGroups?: unknown })
      : {};
  const duplicateGroups = options.duplicateGroups === true;

  let file: ExportFile;
  try {
    file = parseExportFile(fileRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid export file";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Counters for the response summary.
  const created = {
    courseGroups: 0,
    courses: 0,
    labs: 0,
    modules: 0,
    steps: 0,
  };

  // Resolve-or-create a course group by name. Returns the groupId (or null for
  // "no group"). When `duplicateGroups` is true we always create a new group.
  async function resolveGroup(
    g: CourseGroupExport | null,
    fallbackName: string | null
  ): Promise<string | null> {
    if (!g) {
      // No group in the export. If the course explicitly wants to land in no
      // group, respect that. (fallbackName is the course's groupName field.)
      return null;
    }
    const name = g.name?.trim();
    if (!name) return null;

    if (!duplicateGroups) {
      const existing = await db.courseGroup.findFirst({
        where: { name },
      });
      if (existing) return existing.id;
    }

    // Create a new group. Pick an order that puts it at the end so it doesn't
    // clobber the visual ordering of pre-existing groups.
    const maxOrder = await db.courseGroup.aggregate({ _max: { order: true } });
    const created_group = await db.courseGroup.create({
      data: {
        name,
        description: g.description,
        icon: g.icon,
        color: g.color,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    created.courseGroups += 1;
    return created_group.id;
  }

  // Insert one course (with its labs/modules/steps) under a given groupId.
  async function insertCourse(c: CourseExport, groupId: string | null) {
    // Place the imported course at the end of its (possibly new) group so we
    // never displace existing courses.
    const maxOrder = await db.course.aggregate({ _max: { order: true } });
    const courseRow = await db.course.create({
      data: {
        title: c.title,
        description: c.description,
        icon: c.icon,
        color: c.color,
        order: (maxOrder._max.order ?? -1) + 1,
        hidden: c.hidden,
        groupId,
      },
    });
    created.courses += 1;

    for (const lab of c.labs) {
      const labRow = await db.lab.create({
        data: {
          title: lab.title,
          description: lab.description,
          courseId: courseRow.id,
          order: lab.order,
          hidden: lab.hidden,
          linkType: lab.linkType,
          linkUrl: lab.linkUrl,
        },
      });
      created.labs += 1;

      for (const mod of lab.modules) {
        const modRow = await db.module.create({
          data: {
            title: mod.title,
            labId: labRow.id,
            explanation: mod.explanation,
            overview: mod.overview,
            flow: mod.flow,
            output: mod.output,
            conclusion: mod.conclusion,
            order: mod.order,
            hidden: mod.hidden,
          },
        });
        created.modules += 1;

        for (const step of mod.steps) {
          await db.step.create({
            data: {
              title: step.title,
              moduleId: modRow.id,
              description: step.description,
              code: step.code,
              codeLang: step.codeLang,
              image: step.image,
              imageCaption: step.imageCaption,
              order: step.order,
            },
          });
          created.steps += 1;
        }
      }
    }
  }

  try {
    if (file.type === "full") {
      // 1) Ensure all course groups referenced by courses exist.
      //    We pre-resolve groups for every course so the import is robust even
      //    if the `courseGroups` array is incomplete (defensive).
      // 2) Then insert each course.
      // Groups declared at the top level are created first (so they exist
      // before courses attach to them) — unless duplicateGroups is set, in
      // which case each course re-resolves its own group.
      if (!duplicateGroups) {
        for (const g of file.courseGroups) {
          const name = g.name?.trim();
          if (!name) continue;
          const existing = await db.courseGroup.findFirst({
            where: { name },
          });
          if (!existing) {
            const maxOrder = await db.courseGroup.aggregate({
              _max: { order: true },
            });
            await db.courseGroup.create({
              data: {
                name,
                description: g.description,
                icon: g.icon,
                color: g.color,
                order: (maxOrder._max.order ?? -1) + 1,
              },
            });
            created.courseGroups += 1;
          }
        }
      }

      for (const c of file.courses) {
        // Resolve the group for this course. If duplicateGroups is true, we
        // synthesize a CourseGroupExport from the top-level list (by name) so
        // the resolver creates a fresh copy.
        let groupForCourse: CourseGroupExport | null = null;
        if (c.groupName) {
          if (duplicateGroups) {
            const match = file.courseGroups.find(
              (g) => g.name?.trim() === c.groupName?.trim()
            );
            groupForCourse = match ?? { name: c.groupName, description: null, icon: null, color: null, order: 0 };
          } else {
            // Group already ensured to exist above; resolve by name.
            const existing = await db.courseGroup.findFirst({
              where: { name: c.groupName },
            });
            groupForCourse = existing
              ? null // attach by id directly below
              : null;
          }
        }
        let groupId: string | null = null;
        if (c.groupName) {
          if (duplicateGroups && groupForCourse) {
            groupId = await resolveGroup(groupForCourse, c.groupName);
          } else {
            const existing = await db.courseGroup.findFirst({
              where: { name: c.groupName },
            });
            groupId = existing?.id ?? null;
          }
        }
        await insertCourse(c, groupId);
      }
    } else {
      // Single-course import. Recreate the parent group (if any) and the
      // course itself.
      const groupId = await resolveGroup(file.group, file.course.groupName);
      await insertCourse(file.course, groupId);
    }
  } catch (e) {
    // Surface Prisma / DB errors clearly. We have NOT wrapped the writes in a
    // transaction because Neon's pooled endpoint doesn't support interactive
    // transactions well; partial imports are acceptable here (the user can
    // delete the partial course from the admin panel and retry).
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json(
      { error: msg, created },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, created });
}
