import { hasTrackedPreviousRoute, navigateTo, type RouteKey } from "../../config";

type Props = {
  fallbackRoute?: RouteKey;
  onBack?: () => void;
  className?: string;
};

export default function PageBackButton({
  fallbackRoute = "home",
  onBack,
  className = "",
}: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window === "undefined") return;
    if (hasTrackedPreviousRoute(window.location.hash)) {
      window.history.back();
      return;
    }
    navigateTo(fallbackRoute);
  };

  return (
    <button
      type="button"
      className={`page-back-btn ${className}`.trim()}
      onClick={handleBack}
      aria-label="Go back"
    >
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
