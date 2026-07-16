import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeLabLink, type LabLinkInput } from "@/lib/lab-link";

export async function GET(req: NextRequest) {
  const courseId = req.nextUrl.searchParams.get("courseId");
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const includeHidden = adminMode && (await requireAdmin());
  const labs = await db.lab.findMany({
    where: {
      ...(courseId ? { courseId } : {}),
      ...(includeHidden ? {} : { hidden: false }),
    },
    orderBy: { order: "asc" },
    include: { _count: { select: { modules: true } } },
  });
  return NextResponse.json(labs);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { title, description, courseId, linkType, linkUrl } = body;
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }
  const link = normalizeLabLink({ linkType, linkUrl } as LabLinkInput);
  const maxOrder = await db.lab.aggregate({ _max: { order: true }, where: { courseId } });
  const lab = await db.lab.create({
    data: {
      title: title.trim(),
      description: description ?? null,
      courseId,
      order: (maxOrder._max.order ?? -1) + 1,
      linkType: link.linkType,
      linkUrl: link.linkUrl,
    },
  });
  return NextResponse.json(lab, { status: 201 });
}
