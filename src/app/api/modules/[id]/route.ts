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
  const mod = await db.module.findUnique({
    where: { id },
    include: {
      lab: { include: { course: { include: { group: true } } } },
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!includeHidden && (mod.hidden || mod.lab.hidden || mod.lab.course.hidden)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(mod);
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
  const { title, explanation, overview, flow, output, conclusion, order, hidden } = body;
  const mod = await db.module.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(explanation !== undefined && { explanation }),
      ...(overview !== undefined && { overview }),
      ...(flow !== undefined && { flow }),
      ...(output !== undefined && { output }),
      ...(conclusion !== undefined && { conclusion }),
      ...(order !== undefined && { order }),
      ...(hidden !== undefined && { hidden: !!hidden }),
    },
  });
  return NextResponse.json(mod);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.module.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
