import { requireAdminPage } from "@/lib/auth";
import { normalizeSite } from "@/lib/content";
import { mediaUrl } from "@/lib/supabase/config";
import ProfileForm from "@/components/admin/ProfileForm";

export default async function ProfileAdmin() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("site_settings").select("data").eq("id", 1).maybeSingle();
  const site = normalizeSite(data?.data);
  return <ProfileForm initial={site} heroSrc={mediaUrl(site.heroMediaPath)} aboutSrc={mediaUrl(site.aboutImagePath)} />;
}
