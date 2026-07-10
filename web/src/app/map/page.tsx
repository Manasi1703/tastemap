import TasteGraph from "./TasteGraph";

export default function MapPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-lg font-light tracking-tight">TasteMap</h1>
        <a href="/captures" className="text-sm text-white/50 hover:text-white">
          Timeline view
        </a>
      </header>
      <TasteGraph />
    </main>
  );
}
