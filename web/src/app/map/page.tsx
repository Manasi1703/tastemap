import TasteGraph from "./TasteGraph";

export default function MapPage() {
  return (
    <main className="flex h-screen flex-col bg-black text-white">
      <div className="relative min-h-0 flex-1">
        <TasteGraph />
      </div>
    </main>
  );
}
