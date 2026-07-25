import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "linear-gradient(160deg,#fdfaf4 0%,#f6ecd8 50%,#fdfaf4 100%)" }}
    >
      <div className="text-center space-y-6 px-6">
        <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl shadow-2xl"
          style={{ background: "linear-gradient(135deg,#d4a017,#a06010)", boxShadow: "0 10px 30px rgba(160,96,16,0.35)" }}>
          ☕
        </div>
        <div>
          <h1
            className="text-4xl font-serif font-bold"
            style={{
              background: "linear-gradient(135deg,#b8860b,#8a5a10 45%,#c8891a)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Z Pastry Cafe
          </h1>
          <p className="text-xs font-semibold tracking-[0.4em] text-amber-800/60 uppercase mt-1">Dire Dawa · Ethiopia</p>
        </div>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link to="/menu" search={{ table: "12" } as any} className="rounded-xl px-5 py-3 font-semibold text-amber-50 shadow-lg"
            style={{ background: "linear-gradient(135deg,#d4a017,#a06010)", boxShadow: "0 8px 20px rgba(160,96,16,0.3)" }}>
            Customer Menu (Table 12)
          </Link>
          <Link to="/staff" className="rounded-xl px-5 py-3 font-semibold text-amber-900 border border-amber-700/25 bg-white/50 hover:bg-white/80 transition-colors">
            Staff Terminal
          </Link>
        </div>
      </div>
    </div>
  );
}
