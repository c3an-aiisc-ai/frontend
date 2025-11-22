import Background from "./components/background";
import { usePanZoom } from "./hooks/zoom";
import "./App.css";

export default function App() {
  const { containerRef, transform, reset } = usePanZoom({
    initial: { x: 0, y: 0, zoom: 1 },
  });

  return (
    <div className="h-screen w-screen bg-slate-50">
      <div className="h-full flex">
        <aside className="w-64 border-r bg-white p-4">
          <h1 className="font-bold">C3AN Agent Builder</h1>
          <div className="mt-4">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white"
              onClick={reset}
            >
              Reset View
            </button>
          </div>
        </aside>

        <main className="flex-1 relative">
          <div ref={containerRef} className="absolute inset-0">
            <Background transform={transform} />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
                transformOrigin: "0 0",
                width: "100%",
                height: "100%",
                pointerEvents: "auto",
              }}
            >
              <div style={{ padding: 40 }}>
                <div className="p-6 bg-white/80 border rounded shadow-sm">
                  <h2 className="text-lg font-semibold">Canvas Area</h2>
                  <p className="test-sm text-slate-600">build your flow here.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
