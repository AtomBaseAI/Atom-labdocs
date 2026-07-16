import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const groups = await db.courseGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { courses: true } },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, description, icon, color } = body;
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const maxOrder = await db.courseGroup.aggregate({ _max: { order: true } });
  const group = await db.courseGroup.create({
    data: {
      name: name.trim(),
      description: description ?? null,
      icon: icon ?? null,
      color: color ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(group, { status: 201 });
}
