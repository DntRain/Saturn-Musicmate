import clsx from "clsx";

const PLACEHOLDER = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-1/3 w-1/3 text-white/30"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export function CoverArt({
  src,
  size = "md",
  className,
  rounded = "lg",
}: {
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  rounded?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = {
    sm: "h-10 w-10",
    md: "h-14 w-14",
    lg: "h-44 w-44",
    xl: "h-72 w-72",
    full: "h-full w-full",
  } as const;
  const radii = {
    sm: "rounded-md",
    md: "rounded-lg",
    lg: "rounded-xl",
    xl: "rounded-2xl",
  } as const;
  return (
    <div
      className={clsx(
        "grid place-items-center overflow-hidden bg-gradient-to-br from-white/10 to-white/5 shadow-lg shadow-black/30",
        sizes[size],
        radii[rounded],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        PLACEHOLDER
      )}
    </div>
  );
}
