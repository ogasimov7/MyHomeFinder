import Link from "next/link";
import { Suspense } from "react";
import { SideNav, SideNavLinks } from "./SideNav";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="HomeFinder — ana səhifə">
      <svg width="30" height="22" viewBox="0 0 30 22" aria-hidden>
        <path d="M2 20V12.5C2 6.7 7.8 2 15 2s13 4.7 13 10.5V20" fill="none" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M9 20v-6.5C9 10.5 11.7 8 15 8s6 2.5 6 5.5V20" fill="none" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span>homefinder</span>
    </Link>
  );
}

/* The frame is static; only which link is lit depends on the address, so only
   that part waits for it — every route keeps a prerendered shell. */
export function Sidebar() {
  return (
    <aside className="side">
      <Logo />
      <Suspense fallback={<SideNavLinks active={null} saved={0} />}>
        <SideNav />
      </Suspense>
      <p className="side-note">
        Elanlar <b>bina.az</b> və <b>kub.az</b>-dan oxunur, hər ərazinin m²-i ən ucuz elanı “Ən sərfəli” nişanı alır.
      </p>
    </aside>
  );
}
