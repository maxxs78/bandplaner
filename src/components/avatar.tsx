import clsx from "clsx";

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={clsx(
          "shrink-0 rounded-full object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        sizeClasses[size],
        className
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
