import { Suspense } from "react";
import { requireAdminPage } from "@/lib/auth";
import { mediaUrl } from "@/lib/supabase/config";
import { externalThumb } from "@/lib/video";
import { PROJECT_COLUMNS, type Project } from "@/lib/content";
import ProjectManager from "@/components/admin/ProjectManager";

export default async function ProjectsAdmin() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("projects").select(PROJECT_COLUMNS).order("sort_order").order("created_at", { ascending: false });
  const rows = ((data ?? []) as Project[]).map((p) => ({
    ...p,
    videoSrc: mediaUrl(p.video_path),
    thumbSrc: mediaUrl(p.thumb_path) ?? externalThumb(p.video_url),
  }));
  return (
    <Suspense>
      <ProjectManager rows={rows} />
    </Suspense>
  );
}
