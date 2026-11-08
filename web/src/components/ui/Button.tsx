import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "dashed" | "outline";
export type ButtonSize = "md" | "lg" | "xl";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-on hover:bg-accent-hover disabled:bg-accent-pressed",
  secondary: "border border-border-strong bg-surface-3 text-text hover:bg-border",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "bg-transparent font-medium text-text-muted hover:text-text",
  dashed: "border border-dashed border-border-strong bg-transparent font-medium text-text hover:bg-surface-2",
  outline: "border border-border-strong bg-transparent font-medium text-text-muted hover:text-text",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-body",
  lg: "h-11 px-4 text-[15px]",
  xl: "h-13 px-4 text-[16px] font-bold",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  loadingText,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : icon}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
