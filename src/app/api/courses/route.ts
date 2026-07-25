import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// GET: public returns only non-hidden courses; admin (with ?admin=1) returns all.
export async function GET(req: NextRequest) {
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const includeHidden = adminMode && (await requireAdmin());

  const courses = await db.course.findMany({
    where: includeHidden ? undefined : { hidden: false },
    orderBy: { order: "asc" },
    include: {
      group: true,
      _count: {
        select: {
          labs: includeHidden ? true : { where: { hidden: false } },
        },
      },
      // Nested module counts per course (via labs) so the admin dashboard can
      // show a real Modules total. Filters mirror the labs filter above so the
      // public + admin views stay consistent.
      labs: {
        where: includeHidden ? undefined : { hidden: false },
        select: {
          _count: {
            select: {
              modules: includeHidden ? true : { where: { hidden: false } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { title, description, icon, color, groupId } = body;
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const maxOrder = await db.course.aggregate({ _max: { order: true } });
  const course = await db.course.create({
    data: {
      title: title.trim(),
      description: description ?? null,
      icon: icon ?? null,
      color: color ?? null,
      groupId: groupId || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(course, { status: 201 });
}
