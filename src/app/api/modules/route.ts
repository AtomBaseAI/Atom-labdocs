import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const labId = req.nextUrl.searchParams.get("labId");
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const includeHidden = adminMode && (await requireAdmin());
  const modules = await db.module.findMany({
    where: {
      ...(labId ? { labId } : {}),
      ...(includeHidden ? {} : { hidden: false }),
    },
    orderBy: { order: "asc" },
    include: { _count: { select: { steps: true } } },
  });
  return NextResponse.json(modules);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { title, labId } = body;
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!labId) {
    return NextResponse.json({ error: "labId is required" }, { status: 400 });
  }
  const maxOrder = await db.module.aggregate({ _max: { order: true }, where: { labId } });
  const mod = await db.module.create({
    data: {
      title: title.trim(),
      labId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(mod, { status: 201 });
}
