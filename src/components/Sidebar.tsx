"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; icon: string };

export function Sidebar({ items, user, roleLabel }: { items: NavItem[]; user: { name: string; email: string }; roleLabel: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 lg:hidden">
        <Image src="/logo.png" alt="SIDC" width={80} height={41} className="h-8 w-auto" />
        <button className="btn-outline" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">☰</button>
      </header>
      <aside
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white lg:flex`}
      >
        <div className="h-1.5 bg-gradient-to-r from-brand-teal to-brand-plum" />
        <div className="flex items-center gap-2 px-5 py-4">
          <Image src="/logo.png" alt="SIDC" width={96} height={50} className="h-10 w-auto" />
          <span className="text-sm font-semibold text-brand-plum">IT Portal</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map((i) => (
            <Link
              key={i.href} href={i.href} onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                active(i.href) ? "bg-brand-plum text-white" : "text-slate-600 hover:bg-brand-teal-light hover:text-brand-plum"
              }`}
            >
              <span aria-hidden className="w-5 text-center">{i.icon}</span>
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <span className="mt-1 inline-block rounded bg-brand-teal-light px-2 py-0.5 text-xs font-medium text-brand-teal-dark">{roleLabel}</span>
          <form action="/logout" method="post" className="mt-3">
            <button className="btn-outline w-full" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
