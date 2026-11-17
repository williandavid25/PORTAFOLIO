import { requireAdminPage } from "@/lib/auth";
import { mediaUrl } from "@/lib/supabase/config";
import type { Testimonial } from "@/lib/content";
import TestimonialManager from "@/components/admin/TestimonialManager";

export default async function TestimonialsAdmin() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("pf_testimonials").select("id,name,role,body,stars,avatar_path,published,sort_order").order("sort_order").order("created_at", { ascending: false });
  const rows = ((data ?? []) as Testimonial[]).map((t) => ({ ...t, avatarSrc: mediaUrl(t.avatar_path) }));
  return <TestimonialManager rows={rows} />;
}
