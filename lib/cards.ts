import { mediaUrl } from "./supabase/config";
import { externalThumb } from "./video";
import type { Project } from "./content";

export function toCard(project: Project) {
  return {
    project,
    videoUrl: mediaUrl(project.video_path),
    thumbUrl: mediaUrl(project.thumb_path) ?? externalThumb(project.video_url),
  };
}
