import type { Metadata, Viewport } from "next";
import { Inter_Tight, Plus_Jakarta_Sans } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

const body = Inter_Tight({ variable: "--font-body", subsets: ["latin", "latin-ext"] });
const display = Plus_Jakarta_Sans({ variable: "--font-display", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "HomeFinder — Bakıda dəyərli ev", template: "%s · HomeFinder" },
  description:
    "bina.az və kub.az elanları, hər ərazinin içində m² qiymətinə görə müqayisədə. Hər yerin ən sərfəli mənzilini bir baxışda görün.",
};

// "cover" lets the phone tab bar reach under the home indicator; the
// stylesheet pads it back by the safe area.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f1ede6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az" className={`${body.variable} ${display.variable}`}>
      <body>
        <div className="shell">
          <Sidebar />
          <main className="panel">{children}</main>
        </div>
      </body>
    </html>
  );
}
