import type { SVGProps } from "react";

export type ActionIconName = "delete" | "edit" | "save";

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

  return (
    <svg {...sharedProps}>
      <path d="M5 3h13l1 1v17H5Z" />
      <path d="M8 3v6h9" />
      <path d="M8 21v-7h8v7" />
    </svg>
  );
}
