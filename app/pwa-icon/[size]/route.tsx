import { renderIcon } from "@/lib/icon";

const SIZES = new Set([192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const n = Number(size);
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  return renderIcon(n, false);
}
