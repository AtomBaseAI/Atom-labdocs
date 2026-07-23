import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET /api/export/tree
// Returns the full content tree (course groups + courses with nested
// labs/modules) for the selective-export dialog. Admin-only.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [groups, courses] = await Promise.all([
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
              select: {
                id: true,
                title: true,
                hidden: true,
                order: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ groups, courses });
}
