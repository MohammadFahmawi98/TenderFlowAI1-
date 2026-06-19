"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { label: "Dashboard",    href: "/dashboard",    icon: "grid_view" },
  { label: "Tenders",      href: "/tenders",      icon: "description" },
  { label: "Knowledge Hub",href: "/knowledge",    icon: "hub" },
  { label: "Suppliers",    href: "/suppliers",    icon: "inventory_2" },
  { label: "Reports",      href: "/reports",      icon: "bar_chart" },
  { label: "Organization", href: "/organization", icon: "corporate_fare" },
  { label: "Settings",     href: "/settings",     icon: "settings" },
] as const;

/* EIH logo — thick maroon arch + gold crown spikes */
function EIHLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* Thick maroon filled arch */}
      <path
        d="M10 92 C10 92, 10 38, 50 24 C90 38, 90 92, 90 92 L78 92 C78 92, 78 46, 50 34 C22 46, 22 92, 22 92 Z"
        fill="#8B3520"
      />
      {/* Centre spike (tallest) */}
      <path d="M50 24 L53 4 L50 10 L47 4 Z" fill="#C8A24A"/>
      {/* Left-centre spike */}
      <path d="M37 29 L33 10 L31 16 L27 8 L33 23 Z" fill="#C8A24A"/>
      {/* Right-centre spike */}
      <path d="M63 29 L67 10 L69 16 L73 8 L67 23 Z" fill="#C8A24A"/>
      {/* Far-left spike */}
      <path d="M25 40 L16 24 L15 32 L9 26 L17 39 Z" fill="#C8A24A"/>
      {/* Far-right spike */}
      <path d="M75 40 L84 24 L85 32 L91 26 L83 39 Z" fill="#C8A24A"/>
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [userName, setUserName] = useState("User");
  const [userInitials, setUserInitials] = useState("U");
  const [userRole, setUserRole] = useState("Procurement");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = data.user.user_metadata as Record<string, string> | undefined;
        const name = meta?.full_name ?? meta?.name ?? data.user.email?.split("@")[0] ?? "User";
        setUserName(name);
        const parts = name.split(" ");
        setUserInitials(parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase());
        setUserRole(meta?.job_title ?? "Procurement Manager");
      }
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      const res = await fetch("/api/tenders", { method: "POST", body: form });
      const data = await res.json();
      if (data.tenderId) router.push(`/tenders/${data.tenderId}`);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <aside
      style={{ width: 240 }}
      className="flex h-screen shrink-0 flex-col bg-surface border-r border-border"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-border-light">
        <EIHLogo />
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-none" style={{ color: "#8B3520" }}>
            EIH TenderFM
          </p>
          <p className="text-[10px] text-text-muted leading-none mt-0.5">Enterprise Procurement</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3 overflow-y-auto">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard" || pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "relative flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "font-semibold bg-primary-light"
                  : "font-medium text-text-secondary hover:bg-surface-dim hover:text-text",
              ].join(" ")}
              style={active ? { color: "#8B3520" } : {}}
            >
              {active && (
                <span
                  className="absolute inset-y-1 start-0 w-[2.5px] rounded-r"
                  style={{ background: "#C8A24A" }}
                  aria-hidden
                />
              )}
              <span
                className="material-symbols-outlined text-[18px]"
                style={active ? { color: "#C8A24A" } : {}}
                aria-hidden
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Upload RFP button */}
      <div className="px-3 pb-3 pt-2 border-t border-border-light">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-[13px] font-semibold text-white transition-colors"
          style={{ background: "linear-gradient(135deg, #8B3520 0%, #C8A24A 100%)" }}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden>upload_file</span>
          Upload RFP
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {/* User info + sign-out */}
        <div className="mt-3 flex items-center gap-2.5 px-1">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #8B3520, #C8A24A)" }}
          >
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium text-text leading-none truncate">{userName}</p>
            <p className="text-[10px] text-text-muted leading-none mt-0.5">{userRole}</p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
