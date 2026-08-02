import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteFromImageKit } from "@/lib/imagekit";

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
  const {
    title,
    explanation,
    overview,
    flow,
    output,
    outputCode,
    outputCodeLang,
    outputImage,
    outputImageFileId,
    outputImageCaption,
    order,
    hidden,
    locked,
  } = body;

  // Only delete from ImageKit when outputImage is explicitly being removed or replaced
  if (outputImage !== undefined) {
    const current = await db.module.findUnique({ where: { id } });
    if (current?.outputImageFileId) {
      // Image is being removed (set to null) or replaced with a different URL
      if (outputImage === null || (outputImage !== null && outputImage !== current.outputImage)) {
        try {
          await deleteFromImageKit(current.outputImageFileId);
        } catch (err) {
          console.error("Failed to delete old output image from ImageKit:", err);
        }
      }
    }
  }

  const mod = await db.module.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(explanation !== undefined && { explanation }),
      ...(overview !== undefined && { overview }),
      ...(flow !== undefined && { flow }),
      ...(output !== undefined && { output }),
      ...(outputCode !== undefined && { outputCode }),
      ...(outputCodeLang !== undefined && { outputCodeLang }),
      ...(outputImage !== undefined && { outputImage }),
      ...(outputImageFileId !== undefined && { outputImageFileId }),
      ...(outputImageCaption !== undefined && { outputImageCaption }),
      ...(order !== undefined && { order }),
      ...(hidden !== undefined && { hidden: !!hidden }),
      ...(locked !== undefined && { locked: !!locked }),
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

  // Delete associated output image from ImageKit before deleting the module
  const mod = await db.module.findUnique({
    where: { id },
    include: { steps: true },
  });
  if (mod?.outputImageFileId) {
    try {
      await deleteFromImageKit(mod.outputImageFileId);
    } catch (err) {
      console.error("Failed to delete module output image from ImageKit:", err);
    }
  }
  // Delete all step images from ImageKit
  for (const step of mod?.steps ?? []) {
    if (step.imageFileId) {
      try {
        await deleteFromImageKit(step.imageFileId);
      } catch (err) {
        console.error("Failed to delete step image from ImageKit:", err);
      }
    }
  }

  await db.module.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
