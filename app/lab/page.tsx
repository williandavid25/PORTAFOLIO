import type { Metadata } from "next";
import NeonScan from "@/components/lab/NeonScan";

export const metadata: Metadata = {
  title: "Lab · Neon Face Scan",
  description: "Experimento de DevWilly: máscara neón en tiempo real con la cámara, controlada con las manos.",
};

export default function LabPage() {
  return <NeonScan />;
}
