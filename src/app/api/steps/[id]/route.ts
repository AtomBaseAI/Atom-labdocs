import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { title, description, code, codeLang, image, imageCaption, order } = body;
  const step = await db.step.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(code !== undefined && { code }),
      ...(codeLang !== undefined && { codeLang }),
      ...(image !== undefined && { image }),
      ...(imageCaption !== undefined && { imageCaption }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(step);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db.step.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
