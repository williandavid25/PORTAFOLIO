import { requireAdminPage } from "@/lib/auth";
import type { Message } from "@/lib/content";
import MessageList from "@/components/admin/MessageList";

export default async function MessagesAdmin() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("pf_messages").select("id,name,email,project_type,body,read,created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <div className="adm-head"><div><h1>Mensajes</h1><p>Lo que te escriben desde el formulario de contacto.</p></div></div>
      <MessageList rows={(data ?? []) as Message[]} />
    </>
  );
}
