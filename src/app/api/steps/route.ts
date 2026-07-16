import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const moduleId = req.nextUrl.searchParams.get("moduleId");
  const steps = await db.step.findMany({
    where: moduleId ? { moduleId } : undefined,
    orderBy: { order: "asc" },
  });
  return NextResponse.json(steps);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { title, description, code, codeLang, image, imageCaption, moduleId } = body;
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!moduleId) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 });
  }
  const maxOrder = await db.step.aggregate({ _max: { order: true }, where: { moduleId } });
  const step = await db.step.create({
    data: {
      title: title.trim(),
      description: description ?? null,
      code: code ?? null,
      codeLang: codeLang ?? null,
      image: image ?? null,
      imageCaption: imageCaption ?? null,
      moduleId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return NextResponse.json(step, { status: 201 });
}
