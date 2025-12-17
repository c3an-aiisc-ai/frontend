import type { CSSProperties } from "react";

const handleCircle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "9999px",
  backgroundColor: "rgba(250, 204, 21, 0.9)",
  boxShadow: "0 0 0 1px rgba(234, 179, 8, 0.5), 0 3px 8px rgba(234, 179, 8, 0.22)",
};

const handleHalo: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "9999px",
  backgroundColor: "rgba(250, 204, 21, 0.12)",
  boxShadow: "0 0 0 1.5px rgba(234, 179, 8, 0.6)",
};

export default function HandleDot() {
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div className="absolute" style={handleHalo} />
      <div style={handleCircle} />
    </div>
  );
}
