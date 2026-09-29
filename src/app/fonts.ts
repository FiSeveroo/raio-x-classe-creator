import { DM_Sans, Space_Mono } from "next/font/google";
import localFont from "next/font/local";

// Gunterz — fonte de títulos da identidade Classe Creator.
export const gunterz = localFont({
  src: [
    { path: "../fonts/Gunterz-Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/Gunterz-Medium.otf", weight: "500", style: "normal" },
    { path: "../fonts/Gunterz-Bold.otf", weight: "700", style: "normal" },
    { path: "../fonts/Gunterz-Black.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-gunterz",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});
