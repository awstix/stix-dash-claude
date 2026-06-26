"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavigationItem = {
  href: string;
  name: string;
};

export function AppHeader({
  dispositionNavigation,
  primaryNavigation,
  projectNavigation,
  secondaryNavigation,
}: {
  dispositionNavigation: NavigationItem[];
  primaryNavigation: NavigationItem[];
  projectNavigation: NavigationItem[];
  secondaryNavigation: NavigationItem[];
}) {
  const [openMenu, setOpenMenu] = useState<"projects" | "disposition" | null>(
    null,
  );
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const header = headerRef.current;

    function syncHeaderHeight() {
      if (!headerRef.current) {
        return;
      }

      document.documentElement.style.setProperty(
        "--app-header-height",
        `${headerRef.current.offsetHeight}px`,
      );
    }

    syncHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && header
        ? new ResizeObserver(syncHeaderHeight)
        : null;

    if (header && resizeObserver) {
      resizeObserver.observe(header);
    }

    window.addEventListener("resize", syncHeaderHeight);

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        headerRef.current &&
        event.target instanceof Node &&
        !headerRef.current.contains(event.target)
      ) {
        setOpenMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncHeaderHeight);
      document.documentElement.style.removeProperty("--app-header-height");
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-[100] border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur"
      ref={headerRef}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-8 py-4">
        <Link
          className="shrink-0 text-xl font-bold text-gray-900"
          href="/"
          onClick={() => setOpenMenu(null)}
        >
          Dashboard Stix
        </Link>

        <nav className="flex flex-wrap justify-end gap-2 text-sm font-medium text-gray-600">
          {primaryNavigation.map((item) => (
            <NavigationLink
              item={item}
              key={item.href}
              onNavigate={() => setOpenMenu(null)}
            />
          ))}

          <NavigationMenu
            isOpen={openMenu === "projects"}
            items={projectNavigation}
            label="Projekte"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "projects" ? null : "projects",
              )
            }
          />

          <NavigationMenu
            isOpen={openMenu === "disposition"}
            items={dispositionNavigation}
            label="Disposition"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "disposition" ? null : "disposition",
              )
            }
          />

          {secondaryNavigation.map((item) => (
            <NavigationLink
              item={item}
              key={item.href}
              onNavigate={() => setOpenMenu(null)}
            />
          ))}
        </nav>
      </div>
    </header>
  );
}

function NavigationLink({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate: () => void;
}) {
  return (
    <Link
      className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900"
      href={item.href}
      onClick={onNavigate}
    >
      {item.name}
    </Link>
  );
}

function NavigationMenu({
  isOpen,
  items,
  label,
  onNavigate,
  onToggle,
}: {
  isOpen: boolean;
  items: NavigationItem[];
  label: string;
  onNavigate: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-900 ${
          isOpen ? "bg-gray-100 text-gray-900" : ""
        }`}
        onClick={onToggle}
        type="button"
      >
        {label}
      </button>

      {isOpen ? (
        <div
          aria-label={label}
          className="absolute left-0 top-11 z-[110] min-w-[260px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
          role="menu"
        >
          {items.map((item) => (
            <Link
              className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              href={item.href}
              key={item.href}
              onClick={onNavigate}
              role="menuitem"
            >
              {item.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
