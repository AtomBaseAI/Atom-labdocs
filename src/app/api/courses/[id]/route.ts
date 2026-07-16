import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const includeHidden = adminMode && (await requireAdmin());
  const course = await db.course.findUnique({
    where: { id },
    include: {
      group: true,
      labs: includeHidden
        ? { orderBy: { order: "asc" }, include: { _count: { select: { modules: true } } } }
        : {
            where: { hidden: false },
            orderBy: { order: "asc" },
            include: {
              _count: { select: { modules: { where: { hidden: false } } } },
            },
          },
    },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!includeHidden && course.hidden) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(course);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { title, description, icon, color, order, hidden, groupId } = body;
  const course = await db.course.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
      ...(hidden !== undefined && { hidden: !!hidden }),
      ...(groupId !== undefined && { groupId: groupId || null }),
    },
  });
  return NextResponse.json(course);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.course.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
