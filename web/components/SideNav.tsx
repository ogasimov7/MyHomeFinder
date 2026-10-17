"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "@/lib/store";
import { ChartIcon, HeartIcon, HomeIcon, MapIcon, SearchIcon } from "./icons";

const NAV = [
  { href: "/", label: "Ana səhifə", icon: HomeIcon },
  { href: "/search", label: "Axtarış", icon: SearchIcon },
  { href: "/map", label: "Xəritə", icon: MapIcon },
  { href: "/saved", label: "Seçilmişlər", icon: HeartIcon },
  { href: "/how", label: "Necə işləyir", icon: ChartIcon },
] as const;

export function SideNavLinks({ active, saved }: { active: string | null; saved: number }) {
  return (
    <nav className="side-nav" aria-label="Əsas naviqasiya">
      {NAV.map(({ href, label, icon: Icon }) => {
        const on = href === active;
        return (
          <Link key={href} href={href} className={`side-link${on ? " is-active" : ""}`} aria-current={on ? "page" : undefined}>
            <Icon size={19} />
            <span>{label}</span>
            {href === "/saved" && saved > 0 && <em className="side-count">{saved}</em>}
          </Link>
        );
      })}
    </nav>
  );
}

/** A listing page belongs to the search it was opened from. */
function sectionOf(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/listing")) return "/search";
  return NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href))?.href ?? null;
}

export function SideNav() {
  const pathname = usePathname();
  const { saved } = useSaved();
  return <SideNavLinks active={sectionOf(pathname)} saved={saved.length} />;
}
