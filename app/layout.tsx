import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Inter, Dancing_Script, Bebas_Neue, Unbounded, Mr_Dafoe } from "next/font/google";
import "./globals.css";

// Serif del hero (como "Hi, I'm Hawra."), letra ancha y gruesa para los títulos
// (como "Portfolio") y firma manuscrita naranja (como "Hawra_Graphics").
const display = Source_Serif_4({ subsets: ["latin"], variable: "--fd", style: ["normal", "italic"], display: "swap" });
const wide = Unbounded({ subsets: ["latin"], variable: "--fw", weight: ["700", "800", "900"], display: "swap" });
const sign = Mr_Dafoe({ subsets: ["latin"], variable: "--fsig", weight: "400", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--fb", display: "swap" });
const script = Dancing_Script({ subsets: ["latin"], variable: "--fs", weight: ["600", "700"], display: "swap" });
const mono = Bebas_Neue({ subsets: ["latin"], variable: "--fm", weight: "400", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "DevWilly — Video Editor, Programador y Community Manager", template: "%s · DevWilly" },
  description: "DevWilly: editor de video, programador y community manager. Reels, publicidad, video corporativo, motion graphics, desarrollo web y gestión de redes.",
  applicationName: "DevWilly",
  appleWebApp: { capable: true, title: "DevWilly", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", locale: "es_EC", siteName: "DevWilly" },
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
    <html lang="es" className={`${display.variable} ${body.variable} ${script.variable} ${mono.variable} ${wide.variable} ${sign.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
