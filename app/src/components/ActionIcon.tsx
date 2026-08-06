import type { SVGProps } from "react";

export type ActionIconName =
  | "bell"
  | "camera"
  | "close"
  | "delete"
  | "download"
  | "edit"
  | "filter"
  | "key"
  | "logout"
  | "move"
  | "open"
  | "save";

export function ActionIcon({
  name,
  className = "h-4 w-4",
  ...props
}: SVGProps<SVGSVGElement> & {
  name: ActionIconName;
}) {
  const sharedProps = {
    "aria-hidden": true,
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
    ...props,
  };

  if (name === "close") {
    return (
      <svg {...sharedProps}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (name === "camera") {
    return (
      <svg {...sharedProps}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg {...sharedProps}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }

  if (name === "delete") {
    return (
      <svg {...sharedProps}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M6 6l1 16h10l1-16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg {...sharedProps}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg {...sharedProps}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    );
  }

  if (name === "download") {
    return (
      <svg {...sharedProps}>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
    );
  }

  if (name === "open") {
    return (
      <svg {...sharedProps}>
        <path d="M14 3h7v7" />
        <path d="M10 14 21 3" />
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
      </svg>
    );
  }

  if (name === "filter") {
    return (
      <svg {...sharedProps}>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </svg>
    );
  }

  if (name === "key") {
    return (
      <svg {...sharedProps}>
        <circle cx="7.5" cy="15.5" r="4.5" />
        <path d="m10.5 12.5 8-8" />
        <path d="M15.5 7.5 18 5" />
        <path d="M18.5 10.5 21 8" />
      </svg>
    );
  }

  if (name === "move") {
    return (
      <svg {...sharedProps}>
        <path d="M7 7h10" />
        <path d="m14 4 3 3-3 3" />
        <path d="M17 17H7" />
        <path d="m10 14-3 3 3 3" />
      </svg>
    );
  }

  return (
    <svg {...sharedProps}>
      <path d="M5 3h13l1 1v17H5Z" />
      <path d="M8 3v6h9" />
      <path d="M8 21v-7h8v7" />
    </svg>
  );
}
