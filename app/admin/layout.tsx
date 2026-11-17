import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: LayoutProps<"/admin">) {
  return children;
}
