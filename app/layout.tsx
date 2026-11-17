import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter, Dancing_Script, Bebas_Neue } from "next/font/google";
import "./globals.css";

const display = Playfair_Display({ subsets: ["latin"], variable: "--fd", style: ["normal", "italic"], display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--fb", display: "swap" });
const script = Dancing_Script({ subsets: ["latin"], variable: "--fs", weight: ["600", "700"], display: "swap" });
const mono = Bebas_Neue({ subsets: ["latin"], variable: "--fm", weight: "400", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Willy — Video Editor & Content Creator", template: "%s · Willy" },
  description: "Editor de video y creador de contenido: reels, publicidad, video corporativo, color grading y motion graphics.",
  applicationName: "Willy Portfolio",
  appleWebApp: { capable: true, title: "Willy", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", locale: "es_EC", siteName: "Willy — Video Editor" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0503",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${script.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
