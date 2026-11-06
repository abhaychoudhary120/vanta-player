import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  variant?: "glass" | "ghost";
  children: ReactNode;
}

export function IconButton({
  label,
  active = false,
  variant = "ghost",
  children,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-button icon-button--${variant} ${
        active ? "is-active" : ""
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
