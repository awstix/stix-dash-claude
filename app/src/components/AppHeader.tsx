"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type NavigationItem = {
  href: string;
  name: string;
};

export function AppHeader({
  controllingNavigation,
  dispositionNavigation,
  employeeNavigation,
  inventoryNavigation,
  primaryNavigation,
  projectNavigation,
  safetyNavigation,
  secondaryNavigation,
  workshopNavigation,
  companyLogoUrl,
  companyName,
  currentUserName,
}: {
  controllingNavigation: NavigationItem[];
  dispositionNavigation: NavigationItem[];
  employeeNavigation: NavigationItem[];
  inventoryNavigation: NavigationItem[];
  primaryNavigation: NavigationItem[];
  projectNavigation: NavigationItem[];
  safetyNavigation: NavigationItem[];
  secondaryNavigation: NavigationItem[];
  workshopNavigation: NavigationItem[];
  companyLogoUrl: string | null;
  companyName: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<
    | "projects"
    | "disposition"
    | "inventory"
    | "safety"
    | "workshop"
    | "employees"
    | "controlling"
    | null
  >(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      className="sticky top-0 z-[var(--z-header)] border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur"
      ref={headerRef}
    >
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8 2xl:px-10">
        <Link
          className="flex h-12 w-40 shrink-0 items-center"
          href="/"
          onClick={() => setOpenMenu(null)}
        >
          {companyLogoUrl ? (
            <Image
              alt={companyName}
              className="max-h-12 w-auto max-w-40 object-contain object-left"
              height={70}
              priority
              src={companyLogoUrl}
              width={190}
            />
          ) : (
            <span className="text-xl font-bold text-gray-900">
              Dashboard {companyName || "Stix"}
            </span>
          )}
        </Link>

        <button
          aria-expanded={mobileMenuOpen}
          aria-label="Navigation öffnen"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 font-bold text-gray-900 shadow-sm xl:hidden"
          onClick={() => setMobileMenuOpen((current) => !current)}
          type="button"
        >
          {mobileMenuOpen ? "Menü schließen ×" : "Menü ☰"}
        </button>

        <nav className="hidden flex-wrap justify-end gap-2 text-sm font-medium text-gray-600 xl:flex">
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

          <NavigationMenu
            isOpen={openMenu === "inventory"}
            items={inventoryNavigation}
            label="Inventar"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "inventory" ? null : "inventory",
              )
            }
          />

          <NavigationMenu
            isOpen={openMenu === "controlling"}
            items={controllingNavigation}
            label="Controlling"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "controlling" ? null : "controlling",
              )
            }
          />

          <NavigationMenu
            isOpen={openMenu === "safety"}
            items={safetyNavigation}
            label="Arbeitssicherheit"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "safety" ? null : "safety",
              )
            }
          />

          <NavigationMenu
            isOpen={openMenu === "workshop"}
            items={workshopNavigation}
            label="Werkstatt"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "workshop" ? null : "workshop",
              )
            }
          />

          <NavigationMenu
            isOpen={openMenu === "employees"}
            items={employeeNavigation}
            label="Mitarbeiter"
            onNavigate={() => setOpenMenu(null)}
            onToggle={() =>
              setOpenMenu((current) =>
                current === "employees" ? null : "employees",
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
          <div className="ml-2 flex items-center gap-2 border-l border-gray-300 pl-3">
            <span className="max-w-40 truncate font-bold text-gray-900" title={currentUserName}>
              {currentUserName}
            </span>
            <button
              className="rounded-lg border border-gray-400 bg-white px-3 py-2 font-bold text-gray-950 hover:bg-gray-100"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
              type="button"
            >
              Abmelden
            </button>
          </div>
        </nav>
      </div>
      {mobileMenuOpen ? (
        <nav className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-gray-200 bg-white p-4 text-gray-900 shadow-xl xl:hidden">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primaryNavigation.map((item) => (
              <MobileNavigationLink
                item={item}
                key={item.href}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            ))}
            <MobileNavigationSection
              items={projectNavigation}
              label="Projekte"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={dispositionNavigation}
              label="Disposition"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={inventoryNavigation}
              label="Inventar"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={controllingNavigation}
              label="Controlling"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={safetyNavigation}
              label="Arbeitssicherheit"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={workshopNavigation}
              label="Werkstatt"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <MobileNavigationSection
              items={employeeNavigation}
              label="Mitarbeiter"
              onNavigate={() => setMobileMenuOpen(false)}
            />
            {secondaryNavigation.map((item) => (
              <MobileNavigationLink
                item={item}
                key={item.href}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            ))}
            <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
              <p className="truncate font-black">{currentUserName}</p>
              <button
                className="mt-3 w-full rounded-lg border border-gray-500 bg-white px-3 py-2 font-bold text-gray-950"
                onClick={async () => {
                  await authClient.signOut();
                  setMobileMenuOpen(false);
                  router.push("/login");
                  router.refresh();
                }}
                type="button"
              >
                Abmelden
              </button>
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function MobileNavigationLink({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate: () => void;
}) {
  return (
    <Link
      className="flex min-h-12 items-center rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 font-bold"
      href={item.href}
      onClick={onNavigate}
    >
      {item.name}
    </Link>
  );
}

function MobileNavigationSection({
  items,
  label,
  onNavigate,
}: {
  items: NavigationItem[];
  label: string;
  onNavigate: () => void;
}) {
  return (
    <details className="rounded-xl border border-gray-300 bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 font-bold">
        {label}
        <span aria-hidden>⌄</span>
      </summary>
      <div className="space-y-1 border-t border-gray-200 p-2">
        {items.map((item) => (
          <Link
            className="block min-h-11 rounded-lg px-3 py-3 font-semibold text-gray-800 hover:bg-gray-100"
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </details>
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
          className="absolute left-0 top-11 z-[var(--z-header-dropdown)] min-w-[260px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl"
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
