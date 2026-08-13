import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "mint";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--blue-500)] text-white hover:bg-[var(--blue-600)] shadow-[0_10px_30px_-10px_rgba(29,111,242,0.55)]",
  mint:
    "bg-[var(--mint-500)] text-white hover:bg-[var(--mint-600)] shadow-[0_10px_30px_-10px_rgba(14,169,104,0.5)]",
  secondary:
    "bg-[var(--ink)] text-white hover:opacity-90",
  outline:
    "border border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--blue-500)] hover:text-[var(--blue-600)]",
  ghost: "text-[var(--ink)] hover:bg-black/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  icon,
  className,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
