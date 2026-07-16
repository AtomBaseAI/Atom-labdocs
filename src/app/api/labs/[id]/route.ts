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
  const lab = await db.lab.findUnique({
    where: { id },
    include: {
      course: { include: { group: true } },
      modules: includeHidden
        ? { orderBy: { order: "asc" }, include: { _count: { select: { steps: true } } } }
        : {
            where: { hidden: false },
            orderBy: { order: "asc" },
            include: { _count: { select: { steps: true } } },
          },
    },
  });
  if (!lab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!includeHidden && (lab.hidden || lab.course.hidden)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(lab);
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
  const { title, description, order, hidden } = body;
  const lab = await db.lab.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(order !== undefined && { order }),
      ...(hidden !== undefined && { hidden: !!hidden }),
    },
  });
  return NextResponse.json(lab);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.lab.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
