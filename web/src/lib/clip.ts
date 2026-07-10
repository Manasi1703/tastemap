import { pipeline, RawImage, type ZeroShotImageClassificationPipeline } from "@xenova/transformers";
import { STYLE_LABELS } from "./styleLabels";

let classifierPromise: Promise<ZeroShotImageClassificationPipeline> | null = null;

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline(
      "zero-shot-image-classification",
      "Xenova/clip-vit-base-patch32"
    ) as Promise<ZeroShotImageClassificationPipeline>;
  }
  return classifierPromise;
}

export interface ClipResult {
  tags: string[];
  category: string;
  scores: Record<string, number>;
}

export async function classifyImage(imageBuffer: Buffer): Promise<ClipResult> {
  const classifier = await getClassifier();
  const blob = new Blob([new Uint8Array(imageBuffer)]);
  const image = await RawImage.fromBlob(blob);

  const output = await classifier(image, STYLE_LABELS as unknown as string[], {
    hypothesis_template: "a photo in the {} aesthetic",
  });
  const ranked = (Array.isArray(output) ? output : [output]) as {
    label: string;
    score: number;
  }[];

  const scores: Record<string, number> = {};
  for (const { label, score } of ranked) scores[label] = score;

  const top = ranked.slice(0, 5).map((r) => r.label);

  return {
    tags: top,
    category: top[0] ?? "uncategorized",
    scores,
  };
}

export function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const labels = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const label of labels) {
    const va = a[label] ?? 0;
    const vb = b[label] ?? 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
