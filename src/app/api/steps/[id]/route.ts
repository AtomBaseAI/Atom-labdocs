import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteFromImageKit } from "@/lib/imagekit";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const {
    title,
    description,
    code,
    codeLang,
    snippets,
    image,
    imageFileId,
    imageCaption,
    order,
  } = body;

  // Only delete from ImageKit when image is explicitly being removed or replaced
  if (image !== undefined) {
    const current = await db.step.findUnique({ where: { id } });
    if (current?.imageFileId) {
      // Image is being removed (set to null) or replaced with a different URL
      if (image === null || (image !== null && image !== current.image)) {
        try {
          await deleteFromImageKit(current.imageFileId);
        } catch (err) {
          console.error("Failed to delete old image from ImageKit:", err);
        }
      }
    }
  }

  const step = await db.step.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(code !== undefined && { code }),
      ...(codeLang !== undefined && { codeLang }),
      ...(snippets !== undefined && { snippets }),
      ...(image !== undefined && { image }),
      ...(imageFileId !== undefined && { imageFileId }),
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

  // Delete associated image from ImageKit before deleting the step
  const step = await db.step.findUnique({ where: { id } });
  if (step?.imageFileId) {
    try {
      await deleteFromImageKit(step.imageFileId);
    } catch (err) {
      console.error("Failed to delete step image from ImageKit:", err);
    }
  }

  await db.step.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
