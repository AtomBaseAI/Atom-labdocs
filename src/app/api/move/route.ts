import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// POST /api/move
// Body: { type: "module" | "lab" | "course", id: string, targetId: string }
//   - module: move to a different lab (targetId = labId)
//   - lab: move to a different course (targetId = courseId)
//   - course: move to a different group (targetId = groupId or null)
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, id, targetId } = body;

  if (!type || !id || targetId === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: type, id, targetId" },
      { status: 400 }
    );
  }

  try {
    if (type === "module") {
      // Verify target lab exists
      const targetLab = await db.lab.findUnique({ where: { id: targetId } });
      if (!targetLab) {
        return NextResponse.json({ error: "Target lab not found" }, { status: 404 });
      }
      // Get max order in target lab
      const maxOrder = await db.module.aggregate({
        where: { labId: targetId },
        _max: { order: true },
      });
      const updated = await db.module.update({
        where: { id },
        data: {
          labId: targetId,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });
      return NextResponse.json({ ok: true, moved: "module", id: updated.id });
    }

    if (type === "lab") {
      // Verify target course exists
      const targetCourse = await db.course.findUnique({ where: { id: targetId } });
      if (!targetCourse) {
        return NextResponse.json({ error: "Target course not found" }, { status: 404 });
      }
      // Get max order in target course
      const maxOrder = await db.lab.aggregate({
        where: { courseId: targetId },
        _max: { order: true },
      });
      const updated = await db.lab.update({
        where: { id },
        data: {
          courseId: targetId,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });
      return NextResponse.json({ ok: true, moved: "lab", id: updated.id });
    }

    if (type === "course") {
      // targetId can be null (ungroup) or a groupId
      if (targetId !== null) {
        const targetGroup = await db.courseGroup.findUnique({ where: { id: targetId } });
        if (!targetGroup) {
          return NextResponse.json({ error: "Target group not found" }, { status: 404 });
        }
      }
      const maxOrder = await db.course.aggregate({
        where: targetId ? { groupId: targetId } : { groupId: null },
        _max: { order: true },
      });
      const updated = await db.course.update({
        where: { id },
        data: {
          groupId: targetId,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });
      return NextResponse.json({ ok: true, moved: "course", id: updated.id });
    }

    return NextResponse.json(
      { error: `Unknown move type "${type}". Use "module", "lab", or "course".` },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Move failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
