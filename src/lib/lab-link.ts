import type { LabLinkType } from "@/lib/types";

// Input shape coming from API requests / admin forms.
export type LabLinkInput = {
  linkType?: unknown;
  linkUrl?: unknown;
};

// Normalized shape that is safe to persist.
export type LabLink = {
  linkType: LabLinkType;
  linkUrl: string | null;
};

export const LAB_LINK_TYPES: LabLinkType[] = ["none", "download", "watch"];

export function isLabLinkType(value: unknown): value is LabLinkType {
  return typeof value === "string" && (LAB_LINK_TYPES as string[]).includes(value);
}

// Coerce raw form/request input into a clean { linkType, linkUrl } pair.
// Rules:
//  - unknown / invalid linkType -> "none"
//  - "none" always clears the URL (no link to store)
//  - "download" / "watch" keep the URL only when it is a non-empty string
//  - if a URL is missing for download/watch, we still keep the type but url is null
export function normalizeLabLink(input: LabLinkInput): LabLink {
  const rawType = input?.linkType;
  const linkType: LabLinkType = isLabLinkType(rawType) ? rawType : "none";

  const rawUrl = input?.linkUrl;
  const trimmedUrl =
    typeof rawUrl === "string" && rawUrl.trim().length > 0 ? rawUrl.trim() : null;

  if (linkType === "none") {
    return { linkType: "none", linkUrl: null };
  }

  return { linkType, linkUrl: trimmedUrl };
}

// Convenience: does this lab expose a usable external link?
export function labHasLink(lab: { linkType: LabLinkType; linkUrl: string | null }): boolean {
  return lab.linkType !== "none" && !!lab.linkUrl;
}
