import type { PointerEvent } from "react";

type Props = {
  visible: boolean;
  ariaLabel: string;
  onClick: () => void;
  size?: "sm" | "md";
  className?: string;
};

export default function FloatingRemoveButton({
  visible,
  ariaLabel,
  onClick,
  size = "md",
  className = "",
}: Props) {
  const sizeClasses = size === "sm" ? "h-6 w-6 text-xs" : "h-7 w-7 text-xs";
  const visibility = visible ? "scale-100 opacity-100" : "scale-75 opacity-0 pointer-events-none";

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <button
      type="button"
      className={`absolute -right-3 -top-3 flex items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-all duration-150 ${sizeClasses} ${visibility} ${className}`}
      onPointerDown={handlePointerDown}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      ×
    </button>
  );
}
