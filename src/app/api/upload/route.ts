import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { uploadToImageKit, deleteFromImageKit } from "@/lib/imagekit";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "/labdocs";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert File to buffer for ImageKit upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique file name using timestamp + original name
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;

    const result = await uploadToImageKit(buffer, fileName, folder);

    return NextResponse.json({
      url: result.url,
      fileId: result.fileId,
      filePath: result.filePath,
    });
  } catch (err) {
    console.error("ImageKit upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { fileId } = body;

    if (!fileId) {
      return NextResponse.json({ error: "No fileId provided" }, { status: 400 });
    }

    await deleteFromImageKit(fileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ImageKit delete error:", err);
    // Even if deletion fails (e.g., file already deleted), return success
    // so the DB update can proceed — orphaned files are a minor issue
    return NextResponse.json({ ok: true });
  }
}
