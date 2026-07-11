"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Roboto_Mono } from "next/font/google";
import { gsap } from "gsap";
import { forceCollide, forceX, forceY } from "d3-force-3d";

const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["500", "700"] });

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

function drawClusterLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number
) {
  const label = text.toUpperCase();
  const fontPx = 11;
  ctx.font = `700 ${fontPx}px ${robotoMono.style.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const textW = ctx.measureText(label).width;
  const padX = fontPx * 0.9;
  const padY = fontPx * 0.7;
  const halfW = textW / 2 + padX;
  const halfH = fontPx / 2 + padY;
  const corner = fontPx * 0.55;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.2;
  const corners: [number, number, number, number][] = [
    [cx - halfW, cy - halfH, 1, 1],
    [cx + halfW, cy - halfH, -1, 1],
    [cx - halfW, cy + halfH, 1, -1],
    [cx + halfW, cy + halfH, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + corner * dx, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + corner * dy);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(label, cx, cy);
}

interface D3ForceLike {
  strength?: (v: number) => D3ForceLike;
  distance?: (v: number) => D3ForceLike;
}

interface ForceGraphInstance {
  centerAt: {
    (): { x: number; y: number };
    (x: number, y: number, ms?: number): void;
  };
  zoom: {
    (): number;
    (k: number, ms?: number): void;
  };
  d3Force: (name: string, force?: unknown) => D3ForceLike | undefined;
}

type GraphNode = {
  id: string;
  url: string;
  title: string;
  domain: string;
  category: string | null;
  mood: string | null;
  summary: string | null;
  tags: string[];
  imageUrl: string | null;
  createdAt: string;
  status: string;
  x?: number;
  y?: number;
};

type GraphLink = { source: string | GraphNode; target: string | GraphNode; weight: number };

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

const DOT_RADIUS = 2;
const THUMB_SIZE = 34; // world-space size, so it scales naturally with zoom
const GAP = 6;
const NODE_SPACING = 95; // min distance between node centers, keeps thumbnails + cluster label clear

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function imageRect(n: GraphNode, aspect: number) {
  const x = n.x ?? 0;
  const y = n.y ?? 0;
  const w = THUMB_SIZE;
  const h = w / aspect;
  return { x: x - w / 2, y: y - DOT_RADIUS - GAP - h, w, h };
}

export default function TasteGraph() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const aspectCache = useRef<Map<string, number>>(new Map());
  const fgRef = useRef<ForceGraphInstance | undefined>(undefined);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const cameraRef = useRef({ k: 1, x: 0, y: 0 });
  const anchorsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    if (!container) return;
    const update = () => setDimensions({ width: container.clientWidth, height: container.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.json())
      .then((d: GraphData) => {
        d.nodes.forEach((n) => {
          if (!n.imageUrl || imageCache.current.has(n.id)) return;
          const img = new Image();
          img.onload = () => {
            aspectCache.current.set(n.id, img.naturalWidth / img.naturalHeight || 1);
          };
          img.src = n.imageUrl;
          imageCache.current.set(n.id, img);
        });
        setData(d);
      })
      .catch(() => setData({ nodes: [], links: [] }));
  }, []);

  const graphInput = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return { nodes: data.nodes, links: data.links };
  }, [data]);

  const categoryCounts = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, number>();
    for (const n of data.nodes) {
      if (!n.category) continue;
      counts.set(n.category, (counts.get(n.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const summaryText = useMemo(() => {
    if (categoryCounts.length === 0) return "";
    const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
    const [top, ...rest] = categoryCounts.map(([c]) => cap(c));
    if (!rest.length) return `You're gravitating toward ${top}.`;
    const runnersUp = rest.slice(0, 2);
    return `You're gravitating toward ${top}, with strong ${runnersUp.join(" and ")} influences.`;
  }, [categoryCounts]);

  useEffect(() => {
    if (!data) return;

    const categories = Array.from(
      new Set(data.nodes.map((n) => n.category).filter((c): c is string => !!c))
    );
    const baseRadius = 110 + categories.length * 22;
    const anchors = new Map(
      categories.map((cat, i) => {
        const angle = (2 * Math.PI * i) / categories.length + (Math.random() - 0.5) * 0.9;
        const radius = baseRadius * (0.45 + Math.random() * 0.75);
        return [cat, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }];
      })
    );
    anchorsRef.current = anchors;

    const id = setInterval(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.d3Force("charge")?.strength?.(-120);
      fg.d3Force("link")?.distance?.(NODE_SPACING * 1.6);
      fg.d3Force("collide", forceCollide(NODE_SPACING));
      fg.d3Force(
        "x",
        forceX((node: unknown) => anchors.get((node as GraphNode).category ?? "")?.x ?? 0).strength(
          (node: unknown) => ((node as GraphNode).category ? 0.25 : 0)
        )
      );
      fg.d3Force(
        "y",
        forceY((node: unknown) => anchors.get((node as GraphNode).category ?? "")?.y ?? 0).strength(
          (node: unknown) => ((node as GraphNode).category ? 0.25 : 0)
        )
      );
      clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [data]);

  async function handleDelete(id: string) {
    await fetch(`/api/captures/${id}`, { method: "DELETE" });
    setData((prev) =>
      prev
        ? {
            nodes: prev.nodes.filter((n) => n.id !== id),
            links: prev.links.filter(
              (l) =>
                (typeof l.source === "string" ? l.source : l.source.id) !== id &&
                (typeof l.target === "string" ? l.target : l.target.id) !== id
            ),
          }
        : prev
    );
    setSelected(null);
  }

  function syncCameraFromLive(fg: ForceGraphInstance) {
    const center = fg.centerAt();
    cameraRef.current = { x: center.x, y: center.y, k: fg.zoom() };
  }

  function handleNodeClick(node: unknown) {
    const n = node as GraphNode;
    setSelected(n);

    const fg = fgRef.current;
    if (!fg || n.x == null || n.y == null) return;
    syncCameraFromLive(fg);

    gsap.to(cameraRef.current, {
      x: n.x,
      y: n.y,
      k: 2.2,
      duration: 0.7,
      ease: "power3.inOut",
      onUpdate: () => {
        fg.centerAt(cameraRef.current.x, cameraRef.current.y, 0);
        fg.zoom(cameraRef.current.k, 0);
      },
    });
  }

  function handleClusterZoom(category: string) {
    const fg = fgRef.current;
    if (!fg || !data) return;

    const nodesInCluster = data.nodes.filter((n) => n.category === category);
    if (nodesInCluster.length === 0) return;
    syncCameraFromLive(fg);

    const xs = nodesInCluster.map((n) => n.x ?? 0);
    const ys = nodesInCluster.map((n) => n.y ?? 0);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 80);

    const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const targetZoom = Math.min(Math.max((viewportW * 0.5) / span, 0.7), 3.2);

    gsap.to(cameraRef.current, {
      x: cx,
      y: cy,
      k: targetZoom,
      duration: 0.8,
      ease: "power3.inOut",
      onUpdate: () => {
        fg.centerAt(cameraRef.current.x, cameraRef.current.y, 0);
        fg.zoom(cameraRef.current.k, 0);
      },
    });
  }

  if (!data) {
    return <p className="px-8 text-sm text-white/40">Loading your taste map…</p>;
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-2 text-center">
        <p className="text-white/60">Nothing saved yet.</p>
        <p className="text-sm text-white/30">
          Install the TasteMap extension and click it on anything you like.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={setContainer}
      className={`absolute inset-0 ${robotoMono.className}`}
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
      onPointerDown={() => setIsPanning(true)}
      onPointerUp={() => setIsPanning(false)}
      onPointerLeave={() => setIsPanning(false)}
    >
      <ForceGraph2D
        ref={fgRef as never}
        graphData={graphInput as never}
        backgroundColor="#0a0a0a"
        nodeLabel={() => ""}
        nodeRelSize={DOT_RADIUS}
        onZoom={(t: { k: number; x: number; y: number }) => {
          // Mutate in place: replacing the object would orphan any gsap tween
          // currently animating cameraRef.current (see handleClusterZoom).
          cameraRef.current.x = t.x;
          cameraRef.current.y = t.y;
          cameraRef.current.k = t.k;
        }}
        onNodeClick={handleNodeClick}
        onRenderFramePost={(ctx: CanvasRenderingContext2D) => {
          const bounds = new Map<string, { sumX: number; sumY: number; count: number }>();
          for (const n of data.nodes) {
            if (!n.category) continue;
            const x = n.x ?? 0;
            const y = n.y ?? 0;
            const entry = bounds.get(n.category) ?? { sumX: 0, sumY: 0, count: 0 };
            entry.sumX += x;
            entry.sumY += y;
            entry.count += 1;
            bounds.set(n.category, entry);
          }
          bounds.forEach(({ sumX, sumY, count }, category) => {
            if (count <= 3) return;
            drawClusterLabel(ctx, category, sumX / count, sumY / count);
          });
        }}
        linkCanvasObjectMode={() => "replace"}
        linkCanvasObject={(link: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const l = link as { source: GraphNode; target: GraphNode };
          if (typeof l.source !== "object" || typeof l.target !== "object") return;

          ctx.beginPath();
          ctx.moveTo(l.source.x ?? 0, l.source.y ?? 0);
          ctx.lineTo(l.target.x ?? 0, l.target.y ?? 0);
          ctx.strokeStyle = "rgba(145,145,145,0.3)";
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();
        }}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const n = node as GraphNode;
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          const isSelected = selected?.id === n.id;

          // dot
          ctx.beginPath();
          ctx.arc(x, y, isSelected ? DOT_RADIUS * 1.8 : DOT_RADIUS, 0, 2 * Math.PI);
          ctx.fillStyle = "#0a0a0a";
          ctx.fill();
          ctx.lineWidth = 1 / globalScale;
          ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.55)";
          ctx.stroke();

          // date label under the dot
          const fontSize = 3;
          ctx.font = `${fontSize}px -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillText(formatDate(n.createdAt), x, y + DOT_RADIUS + 1.5);

          // thumbnail floating above the dot, natural aspect ratio, no crop
          const img = n.imageUrl ? imageCache.current.get(n.id) : null;
          const aspect = aspectCache.current.get(n.id) ?? 1;
          if (img && img.complete && img.naturalWidth > 0) {
            const rect = imageRect(n, aspect);

            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.lineWidth = 1 / globalScale;
            ctx.beginPath();
            ctx.moveTo(x, y - DOT_RADIUS);
            ctx.lineTo(x, rect.y + rect.h);
            ctx.stroke();

            ctx.save();
            if (isSelected) {
              ctx.shadowColor = "rgba(255,255,255,0.5)";
              ctx.shadowBlur = 12 / globalScale;
            }
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
            ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.2)";
            ctx.lineWidth = (isSelected ? 1.5 : 1) / globalScale;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            ctx.restore();
          }
        }}
        nodePointerAreaPaint={(node: unknown, color: string, ctx: CanvasRenderingContext2D) => {
          const n = node as GraphNode;
          const y = n.y ?? 0;
          const aspect = aspectCache.current.get(n.id) ?? 1;
          const rect = imageRect(n, aspect);
          ctx.fillStyle = color;
          ctx.fillRect(rect.x, rect.y, rect.w, y - rect.y);
        }}
        width={dimensions.width}
        height={dimensions.height}
      />

      <div
        className={`absolute right-0 top-0 h-full transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute -left-8 top-6 flex h-8 w-8 items-center justify-center rounded-l-lg border border-r-0 border-white/10 bg-[#0a0a0a] text-white/50 hover:text-white"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? "›" : "‹"}
        </button>

        <div
          className="h-full w-72 overflow-y-auto border-l border-white/10 bg-[#0a0a0a]/95 p-5 backdrop-blur"
          style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          <h1 className="text-lg font-light tracking-tight">TasteMap</h1>

          <h2 className="mt-5 text-base font-medium uppercase tracking-wide text-white/40">
            Your aesthetic
          </h2>

          {summaryText && (
            <p className="mt-2 text-base leading-snug text-white/80">{summaryText}</p>
          )}

          <p className="mt-3 text-sm text-white/30">
            {categoryCounts.length} style{categoryCounts.length === 1 ? "" : "s"} identified
            across {data.nodes.length} saves
          </p>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {categoryCounts.map(([category, count]) => (
              <button
                key={category}
                onClick={() => handleClusterZoom(category)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${robotoMono.className} border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:bg-white/10 hover:text-white`}
              >
                {category.toUpperCase()}
                <span className="ml-1.5 text-white/35">{count}</span>
              </button>
            ))}
            {categoryCounts.length === 0 && (
              <p className="text-xs text-white/30">
                Nothing tagged yet — save a few more items.
              </p>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          style={{ animation: "tastemap-fade-in 0.15s ease-out" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-5"
            style={{ animation: "tastemap-pop-in 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">{selected.title}</h3>
                <p className="mt-0.5 text-xs text-white/40">{selected.domain}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>

            {selected.imageUrl && (
              <a href={selected.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.imageUrl}
                  alt={selected.title}
                  className="mt-4 max-h-[55vh] w-full rounded-xl border border-white/10 object-contain"
                />
              </a>
            )}

            {selected.summary && (
              <p className="mt-3 text-xs text-white/50">{selected.summary}</p>
            )}

            {selected.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded-full border border-white/15 py-1.5 text-center text-xs text-white/70 hover:bg-white/5"
              >
                Open source
              </a>
              <button
                onClick={() => handleDelete(selected.id)}
                className="flex-1 rounded-full border border-red-500/30 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes tastemap-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes tastemap-pop-in {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
