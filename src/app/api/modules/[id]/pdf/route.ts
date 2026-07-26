import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// ─── Vercel-compatible PDF generation ───
// Instead of spawning a child process (which Vercel serverless does NOT support),
// we return the beautifully styled HTML document directly. The HTML has perfect
// @page CSS for A4 format with proper margins. When the user opens this HTML,
// their browser's "Print → Save as PDF" produces a high-quality PDF — identical
// to what Puppeteer would generate, but without any server-side browser dependency.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adminMode = req.nextUrl.searchParams.get("admin") === "1";
  const includeHidden = adminMode && (await requireAdmin());

  // Fetch module with all steps and course/lab context
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

  const accent = mod.lab.course.group?.color ?? "#0d9488";
  const courseTitle = mod.lab.course.title;
  const labTitle = mod.lab.title;

  // Generate HTML document
  const html = generateModuleHTML(mod, courseTitle, labTitle, accent);

  const filename = `${mod.title.replace(/[^a-zA-Z0-9]/g, "_")}.html`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateModuleHTML(
  mod: {
    id: string;
    title: string;
    explanation: string | null;
    overview: string | null;
    flow: string | null;
    output: string | null;
    outputCode: string | null;
    outputCodeLang: string | null;
    outputImage: string | null;
    outputImageCaption: string | null;
    steps: {
      id: string;
      title: string;
      description: string | null;
      code: string | null;
      codeLang: string | null;
      snippets: string | null;
      image: string | null;
      imageCaption: string | null;
      order: number;
    }[];
  },
  courseTitle: string,
  labTitle: string,
  accent: string
): string {
  // Parse flow
  let flowNodes: { id: string; label: string; type: string }[] | null = null;
  if (mod.flow) {
    try {
      const parsed = JSON.parse(mod.flow);
      if (Array.isArray(parsed)) flowNodes = parsed;
    } catch {}
  }

  // Parse snippets for each step
  const stepsWithSnippets = mod.steps.map((step) => {
    let parsedSnippets: { id?: string; title?: string; lang: string; code: string }[] | null = null;
    if (step.snippets) {
      try {
        const raw = typeof step.snippets === "string" ? JSON.parse(step.snippets) : step.snippets;
        if (Array.isArray(raw) && raw.length > 0) parsedSnippets = raw;
      } catch {}
    }
    return { ...step, parsedSnippets };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(mod.title)}</title>
<style>
@page {
  size: A4;
  margin: 20mm 18mm 20mm 18mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #1a1a2e;
  line-height: 1.6;
  font-size: 11pt;
}

/* ── Print overlay bar: visible on screen, hidden when printing ── */
.print-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  background: ${accent};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1em;
  padding: 0.6em 1.5em;
  font-size: 0.85em;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.print-bar button {
  background: #fff;
  color: ${accent};
  border: none;
  border-radius: 6px;
  padding: 0.4em 1.2em;
  font-size: 0.85em;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.print-bar button:hover { opacity: 0.85; }
.print-bar .close-btn {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.5);
  padding: 0.3em 0.8em;
  font-weight: 500;
}

@media print {
  .print-bar { display: none !important; }
  body { padding-top: 0 !important; }
}

.rich-content { line-height: 1.7; }
.rich-content p { margin: 0.5em 0; }
.rich-content h1 { font-size: 1.6em; margin: 0.8em 0 0.4em; font-weight: 700; }
.rich-content h2 { font-size: 1.3em; margin: 0.6em 0 0.3em; font-weight: 600; }
.rich-content h3 { font-size: 1.1em; margin: 0.5em 0 0.3em; font-weight: 600; }
.rich-content ul, .rich-content ol { margin: 0.5em 0; padding-left: 1.5em; }
.rich-content li { margin: 0.2em 0; }
.rich-content blockquote { border-left: 3px solid ${accent}; margin: 0.8em 0; padding: 0.4em 1em; background: ${accent}11; font-style: italic; }
.rich-content code { background: #f1f3f5; padding: 0.15em 0.4em; border-radius: 3px; font-size: 0.9em; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; }
.rich-content pre { background: #282c34; color: #abb2bf; padding: 1em 1.25em; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 0.85em; line-height: 1.5; }
.rich-content pre code { background: transparent; padding: 0; color: inherit; }
.rich-content a { color: ${accent}; text-decoration: underline; }
.rich-content strong { font-weight: 700; }
.rich-content em { font-style: italic; }
.rich-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; }
.rich-content table { width: 100%; border-collapse: collapse; margin: 0.8em 0; }
.rich-content th, .rich-content td { border: 1px solid #d1d5db; padding: 0.5em 0.75em; text-align: left; }
.rich-content th { background: #f3f4f6; font-weight: 600; }

.page { max-width: 100%; padding: 0; }
body { padding-top: 3em; } /* room for the print bar */
.cover { background: linear-gradient(135deg, ${accent}18, ${accent}08); border-radius: 12px; padding: 2em 2.5em; margin-bottom: 2em; border: 1px solid ${accent}30; }
.cover h1 { font-size: 1.8em; font-weight: 800; color: ${accent}; margin: 0 0 0.5em; }
.cover .breadcrumb { display: flex; align-items: center; gap: 0.5em; font-size: 0.85em; color: #6b7280; margin-bottom: 0.8em; }
.cover .breadcrumb span { background: #f3f4f6; padding: 0.2em 0.6em; border-radius: 4px; }
.cover .breadcrumb .arrow { background: none; padding: 0; color: #9ca3af; }
.section-tag { display: inline-flex; align-items: center; gap: 0.5em; background: ${accent}15; border: 1px solid ${accent}30; color: #6b7280; padding: 0.3em 0.8em; border-radius: 20px; font-size: 0.75em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1em; }
.step-section { margin: 2em 0; page-break-inside: avoid; }
.step-header { display: flex; align-items: center; gap: 0.8em; margin-bottom: 1em; }
.step-number { display: inline-flex; align-items: center; justify-content: center; width: 2.2em; height: 2.2em; border-radius: 50%; background: ${accent}; color: #fff; font-weight: 700; font-size: 0.9em; flex-shrink: 0; }
.step-title { font-size: 1.2em; font-weight: 700; color: ${accent}; }
.step-body { background: #f8fafc; border-radius: 8px; padding: 1em 1.5em; border: 1px solid #e5e7eb; }
.code-block { background: #282c34; border-radius: 8px; overflow: hidden; margin: 0.8em 0; page-break-inside: avoid; }
.code-block-header { display: flex; align-items: center; justify-content: space-between; background: #1e222a; padding: 0.5em 1em; border-bottom: 1px solid rgba(255,255,255,0.1); }
.code-block-header .dots { display: flex; gap: 0.4em; }
.code-block-header .dot { width: 0.75em; height: 0.75em; border-radius: 50%; }
.code-block-header .dot-red { background: #ff5f56; }
.code-block-header .dot-yellow { background: #ffbd2e; }
.code-block-header .dot-green { background: #27c93f; }
.code-block-header .lang-label { color: #abb2bf; font-size: 0.8em; margin-left: 1em; font-weight: 500; }
.code-block-body { padding: 1em 1.25em; overflow-x: auto; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace; font-size: 0.8em; line-height: 1.5; color: #abb2bf; white-space: pre-wrap; word-break: break-word; }
.code-label { display: flex; align-items: center; gap: 0.5em; font-size: 0.8em; font-weight: 600; color: #6b7280; margin-bottom: 0.5em; }
.step-image { margin: 1em 0; page-break-inside: avoid; }
.step-image img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; }
.step-image .caption { text-align: center; font-size: 0.8em; color: #6b7280; margin-top: 0.3em; }
.image-label { display: flex; align-items: center; gap: 0.5em; font-size: 0.8em; font-weight: 600; color: #6b7280; margin-bottom: 0.5em; }
.flow-section { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1em 1.5em; margin: 1em 0; }
.flow-section h4 { font-size: 0.8em; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.8em; }
.flow-diagram { display: flex; flex-direction: column; align-items: center; gap: 0.5em; }
.flow-node { display: inline-flex; align-items: center; justify-content: center; padding: 0.5em 1.5em; border-radius: 8px; font-size: 0.85em; font-weight: 600; min-width: 6em; }
.flow-node.start { background: ${accent}; color: #fff; border-radius: 20px; }
.flow-node.end { background: #ef4444; color: #fff; border-radius: 20px; }
.flow-node.process { background: #f3f4f6; color: #1a1a2e; border: 1px solid #d1d5db; }
.flow-node.decision { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
.flow-node.io { background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6; }
.flow-arrow { color: #9ca3af; font-size: 1.2em; }
.output-section { margin: 2em 0; page-break-inside: avoid; }
.explanation-section { margin: 1.5em 0; padding-left: 1.5em; border-left: 3px solid ${accent}66; }
</style>
</head>
<body>

<!-- Print / Save-as-PDF overlay bar (hidden when printing) -->
<div class="print-bar">
  <span>Save as PDF:</span>
  <button onclick="window.print()">Print / Save as PDF</button>
  <button class="close-btn" onclick="this.parentElement.remove(); document.body.style.paddingTop='0';">Close bar</button>
</div>

<div class="page">

<div class="cover">
  <div class="breadcrumb">
    <span>${escapeHtml(courseTitle)}</span>
    <span class="arrow">→</span>
    <span>${escapeHtml(labTitle)}</span>
  </div>
  <h1>${escapeHtml(mod.title)}</h1>
  ${mod.explanation ? `<div class="explanation-section"><div class="rich-content">${mod.explanation}</div></div>` : ""}
</div>

${mod.overview ? `
<div style="margin: 2em 0; page-break-inside: avoid;">
  <div class="section-tag">📋 Overview &amp; Flow</div>
  <div class="rich-content">${mod.overview}</div>
  ${flowNodes && flowNodes.length > 0 ? `
  <div class="flow-section">
    <h4>Flow Diagram</h4>
    <div class="flow-diagram">
      ${flowNodes.map((node) => `<div class="flow-node ${node.type}">${escapeHtml(node.label)}</div><div class="flow-arrow">↓</div>`).join("").replace(/<div class="flow-arrow">↓<\/div>\s*$/, "")}
    </div>
  </div>
  ` : ""}
</div>
` : ""}

<div class="section-tag">📝 Lab Procedure</div>
${stepsWithSnippets.map((step, i) => `
<div class="step-section">
  <div class="step-header">
    <div class="step-number">${i + 1}</div>
    <div class="step-title">${escapeHtml(step.title)}</div>
  </div>
  <div class="step-body">
    ${step.description ? `<div class="rich-content">${step.description}</div>` : ""}
    ${step.parsedSnippets ? step.parsedSnippets.map((snip) => `
    <div class="code-label">⌨ ${escapeHtml(snip.title || `Code ${step.parsedSnippets!.indexOf(snip) + 1}`)}</div>
    <div class="code-block">
      <div class="code-block-header"><div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div><div class="lang-label">${escapeHtml(snip.lang || "text")}</div></div>
      <div class="code-block-body">${escapeHtml(snip.code)}</div>
    </div>
    `).join("") : step.code ? `
    <div class="code-label">⌨ Code</div>
    <div class="code-block">
      <div class="code-block-header"><div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div><div class="lang-label">${escapeHtml(step.codeLang || "text")}</div></div>
      <div class="code-block-body">${escapeHtml(step.code)}</div>
    </div>
    ` : ""}
    ${step.image ? `
    <div class="step-image">
      <div class="image-label">🖼 Image</div>
      <img src="${step.image}" alt="${escapeHtml(step.imageCaption || "Step illustration")}" />
      ${step.imageCaption ? `<div class="caption">${escapeHtml(step.imageCaption)}</div>` : ""}
    </div>
    ` : ""}
  </div>
</div>
`).join("")}

${mod.output || mod.outputCode || mod.outputImage ? `
<div class="output-section">
  <div class="section-tag">🖥 Expected Output</div>
  <h2 style="font-size: 1.3em; font-weight: 700; color: ${accent}; margin-bottom: 1em;">Output</h2>
  ${mod.output ? `<div class="rich-content" style="background: #f8fafc; border-radius: 8px; padding: 1em 1.5em; border: 1px solid #e5e7eb;">${mod.output}</div>` : ""}
  ${mod.outputCode ? `
  <div class="code-label">⌨ Output Code</div>
  <div class="code-block">
    <div class="code-block-header"><div class="dots"><div class="dot dot-red"></div><div class="dot dot-yellow"></div><div class="dot dot-green"></div></div><div class="lang-label">${escapeHtml(mod.outputCodeLang || "text")}</div></div>
    <div class="code-block-body">${escapeHtml(mod.outputCode)}</div>
  </div>
  ` : ""}
  ${mod.outputImage ? `
  <div class="step-image">
    <div class="image-label">🖼 Output Image</div>
    <img src="${mod.outputImage}" alt="${escapeHtml(mod.outputImageCaption || "Output illustration")}" />
    ${mod.outputImageCaption ? `<div class="caption">${escapeHtml(mod.outputImageCaption)}</div>` : ""}
  </div>
  ` : ""}
</div>
` : ""}

</div>
</body>
</html>`;
}
