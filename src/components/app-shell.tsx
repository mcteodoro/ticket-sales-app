"use client";

import {
  BarChart3,
  LogOut,
  Menu,
  Plus,
  ReceiptText,
  Ticket,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/sales/new", label: "New sale", icon: Plus },
];

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
              active
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
            <Ticket className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-950">Ticket Desk</p>
            <p className="text-xs text-slate-500">Sales manager</p>
          </div>
        </div>

        <div className="mt-8">{nav}</div>

        <div className="absolute inset-x-4 bottom-5">
          <p className="truncate text-xs text-slate-500">{userEmail}</p>
          <form action="/auth/signout" method="post" className="mt-3">
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Ticket className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-slate-950">Ticket Desk</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700"
            aria-label="Open navigation"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {open ? <div className="mt-4">{nav}</div> : null}
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
