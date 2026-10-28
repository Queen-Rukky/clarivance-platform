"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "", label: "Overview" },
  { href: "/leads", label: "Leads" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/setup", label: "Setup" },
  { href: "/team", label: "Team" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
] as const;

// Sidebar on wide screens, a scrollable tab row on phones.
export function WorkspaceNav({ businessId, businessName }: { businessId: string; businessName: string }) {
  const pathname = usePathname();
  const base = `/b/${businessId}`;
  const isActive = (href: string) => (href === "" ? pathname === base : pathname.startsWith(base + href));

  return (
    <nav aria-label="Workspace" className="md:w-56 md:shrink-0">
      <div className="hidden px-3 pb-3 md:block">
        <p className="eyebrow">Workspace</p>
        <p className="truncate font-semibold" title={businessName}>{businessName}</p>
      </div>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.label} className="shrink-0">
              <Link
                href={base + item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden px-3 pt-4 md:block">
        <Link href="/dashboard" className="text-sm text-muted underline-offset-4 hover:underline">Switch business</Link>
      </div>
    </nav>
  );
}
