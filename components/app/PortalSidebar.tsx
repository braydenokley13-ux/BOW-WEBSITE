"use client";

import Link from "next/link";
import type { Role } from "@/lib/account";
import type { NavEntry } from "@/lib/navigation/catalog";
import PortalNavList from "./PortalNavList";

function brandHomeFor(role: Role): string {
  if (role === "student") return "/dashboard";
  if (role === "instructor") return "/app/teach";
  return "/app";
}

export default function PortalSidebar({
  role,
  navigation,
  activeId,
  accountName,
  accountRoleLabel,
  accountAccent,
  accountInitials,
  onSignOut,
}: {
  role: Role;
  navigation: NavEntry[];
  activeId: string | null;
  accountName: string;
  accountRoleLabel: string;
  accountAccent: string;
  accountInitials: string;
  onSignOut: () => void;
}) {
  return (
    <aside className="bow-portal-sidebar">
      <Link href={brandHomeFor(role)} aria-label="BOW home" className="bow-portal-sidebar__brand">
        <span className="bow-portal-sidebar__brand-mark">BOW</span>
        <span className="bow-portal-sidebar__brand-name">Sports Capital</span>
      </Link>

      <PortalNavList navigation={navigation} activeId={activeId} />

      <div className="bow-portal-account">
        <div className="bow-portal-account__identity">
          <span className="bow-portal-account__avatar" style={{ background: accountAccent }}>{accountInitials}</span>
          <span className="bow-portal-account__name">
            <span>{accountName}</span>
            <span className="bow-portal-account__role">{accountRoleLabel}</span>
          </span>
        </div>
        <div className="bow-portal-account__links">
          <Link href="/app/settings">Account settings</Link>
          <Link href="/" target="_blank" rel="noopener noreferrer">Public site</Link>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </aside>
  );
}
