"use client";

import Link from "next/link";
import type { NavEntry } from "@/lib/navigation/catalog";
import PortalNavList from "./PortalNavList";

export default function PortalMobileNav({
  open,
  onClose,
  navigation,
  activeId,
  accountName,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  navigation: NavEntry[];
  activeId: string | null;
  accountName: string;
  onSignOut: () => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="bow-portal-sheet-backdrop" onClick={onClose} />
      <div id="bow-portal-mobile-sheet" className="bow-portal-sheet" role="dialog" aria-modal="true" aria-label="Navigation">
        <div className="bow-portal-sheet__head">
          <span className="bow-portal-sidebar__brand-mark">BOW</span>
          <button type="button" className="bow-portal-sheet__close" onClick={onClose} aria-label="Close menu">
            ×
          </button>
        </div>
        <div className="bow-portal-sheet__scroll">
          <PortalNavList navigation={navigation} activeId={activeId} onNavigate={onClose} />
          <div className="bow-portal-account">
            <div className="bow-portal-account__identity">
              <span className="bow-portal-account__name"><span>{accountName}</span></span>
            </div>
            <div className="bow-portal-account__links">
              <Link href="/app/settings" onClick={onClose}>Account settings</Link>
              <Link href="/" target="_blank" rel="noopener noreferrer" onClick={onClose}>Public site</Link>
              <button type="button" onClick={onSignOut}>Sign out</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
