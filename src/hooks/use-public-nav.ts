"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/app-store";

/**
 * Synchronizes public navigation state with URL search params.
 *
 * URL format:
 *   /                          → course list (home)
 *   /?course=xxx               → course view
 *   /?course=xxx&lab=yyy       → lab view
 *   /?course=xxx&lab=yyy&module=zzz → module view
 *
 * On mount: URL params → Zustand store (so refresh preserves position)
 * On navigation: Zustand store → URL (via router.replace)
 */

export function usePublicNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  const store = useAppStore();

  // ──── One-time init: URL → Store ────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const courseParam = searchParams.get("course");
    const labParam = searchParams.get("lab");
    const moduleParam = searchParams.get("module");

    // Only init if URL has actual params (otherwise store defaults are fine)
    if (courseParam || labParam || moduleParam) {
      store.initPublicNav(courseParam, labParam, moduleParam);
    }
  }, []);

  // ──── Navigation helpers: update both Store + URL ────

  /** Push URL using router.replace (no extra history entries) */
  const pushURL = useCallback(
    (courseId: string | null, labId: string | null, moduleId: string | null) => {
      const params = new URLSearchParams();
      if (courseId) params.set("course", courseId);
      if (labId) params.set("lab", labId);
      if (moduleId) params.set("module", moduleId);

      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/");
    },
    [router]
  );

  const goRoot = useCallback(() => {
    store.initPublicNav(null, null, null);
    pushURL(null, null, null);
  }, [store, pushURL]);

  const goToCourse = useCallback(
    (courseId: string) => {
      store.selectCourse(courseId);
      pushURL(courseId, null, null);
    },
    [store, pushURL]
  );

  const goToLab = useCallback(
    (labId: string) => {
      // Keep current courseId when drilling into a lab
      const currentCourseId = useAppStore.getState().selectedCourseId;
      store.selectLab(labId);
      pushURL(currentCourseId, labId, null);
    },
    [store, pushURL]
  );

  const goToModule = useCallback(
    (moduleId: string) => {
      const s = useAppStore.getState();
      store.selectModule(moduleId);
      pushURL(s.selectedCourseId, s.selectedLabId, moduleId);
    },
    [store, pushURL]
  );

  /** Go back to course list from within a module view */
  const goToCourseFromModule = useCallback(
    (courseId: string) => {
      store.initPublicNav(courseId, null, null);
      pushURL(courseId, null, null);
    },
    [store, pushURL]
  );

  /** Go back to lab list from within a module view */
  const goToLabFromModule = useCallback(
    (labId: string) => {
      const currentCourseId = useAppStore.getState().selectedCourseId;
      store.initPublicNav(currentCourseId, labId, null);
      pushURL(currentCourseId, labId, null);
    },
    [store, pushURL]
  );

  return {
    selectedCourseId: store.selectedCourseId,
    selectedLabId: store.selectedLabId,
    selectedModuleId: store.selectedModuleId,
    goRoot,
    goToCourse,
    goToLab,
    goToModule,
    goToCourseFromModule,
    goToLabFromModule,
  };
}
