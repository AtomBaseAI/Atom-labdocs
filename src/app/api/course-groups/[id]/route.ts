import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteFromImageKit } from "@/lib/imagekit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const group = await db.courseGroup.findUnique({
    where: { id },
    include: {
      courses: { orderBy: { order: "asc" }, include: { _count: { select: { labs: true } } } },
    },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
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
  const { name, icon, color, order } = body;
  const group = await db.courseGroup.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(icon !== undefined && { icon }),
      ...(color !== undefined && { color }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(group);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  // Clean up all ImageKit files before cascading delete
  const group = await db.courseGroup.findUnique({
    where: { id },
    include: {
      courses: {
        include: {
          labs: {
            include: {
              modules: {
                include: {
                  steps: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (group) {
    for (const course of group.courses) {
      for (const lab of course.labs) {
        for (const mod of lab.modules) {
          if (mod.outputImageFileId) {
            try { await deleteFromImageKit(mod.outputImageFileId); } catch {}
          }
          for (const step of mod.steps) {
            if (step.imageFileId) {
              try { await deleteFromImageKit(step.imageFileId); } catch {}
            }
          }
        }
      }
    }
  }

  await db.courseGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
