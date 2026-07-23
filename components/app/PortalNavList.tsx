"use client";

import Link from "next/link";
import type { NavEntry } from "@/lib/navigation/catalog";
import { groupContainsActive } from "@/lib/navigation/catalog";
import { NAV_ICON_BY_ID } from "./NavIcons";

interface PortalNavListProps {
  navigation: NavEntry[];
  activeId: string | null;
  onNavigate?: () => void;
}

/** Flat primary items + a visually de-emphasized secondary (Admin) group. */
export default function PortalNavList({ navigation, activeId, onNavigate }: PortalNavListProps) {
  const primary = navigation.filter((entry) => entry.kind === "link");
  const groups = navigation.filter((entry) => entry.kind === "group");

  return (
    <>
      <nav className="bow-portal-nav" aria-label="Primary navigation">
        {primary.map((entry) => {
          const Icon = NAV_ICON_BY_ID[entry.id];
          const active = entry.id === activeId;
          return (
            <Link
              key={entry.id}
              href={entry.href}
              className="bow-portal-nav__link"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              {Icon && <Icon />}
              <span>{entry.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="bow-portal-sidebar__spacer" />

      {groups.map((group) => {
        const Icon = NAV_ICON_BY_ID[group.id];
        const groupActive = groupContainsActive(group, activeId);
        return (
          <nav className="bow-portal-nav bow-portal-nav--secondary" aria-label={group.label} key={group.id}>
            <span className="bow-portal-nav__label">{group.label}</span>
            {group.items.map((item) => {
              const active = item.id === activeId;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="bow-portal-nav__link"
                  data-active={active ? "true" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                >
                  {Icon && <Icon />}
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {!groupActive && null}
          </nav>
        );
      })}
    </>
  );
}
