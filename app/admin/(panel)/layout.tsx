import { requireAdminPage } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { supabase } = await requireAdminPage();
  const { count } = await supabase.from("pf_messages").select("id", { count: "exact", head: true }).eq("read", false);
  return (
    <div className="adm">
      <AdminNav unread={count ?? 0} />
      <main className="adm-main">{children}</main>
    </div>
  );
}
