import MotionRoot from "@/components/motion/MotionRoot";
import Nav from "@/components/site/Nav";
import Footer from "@/components/site/Footer";
import { getSite } from "@/lib/data";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const site = await getSite();
  return (
    <MotionRoot>
      <Nav name={site.name} role={site.role} />
      <main>{children}</main>
      <Footer site={site} />
    </MotionRoot>
  );
}
