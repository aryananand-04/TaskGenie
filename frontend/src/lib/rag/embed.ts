// Embeddings via Gemini text-embedding-004 (reuses the existing SDK — no new
// dependency). Batched and length-capped to stay within the model's input
// limit (~2048 tokens) and friendly to free-tier rate limits.

import { GoogleGenerativeAI } from "@google/generative-ai";

const EMBED_MODEL = "text-embedding-004";
const BATCH = 100;
// text-embedding-004 caps input at ~2048 tokens. ~6000 chars of code is a safe
// budget (roughly < 2000 tokens) that avoids per-request 400s on dense files.
const MAX_CHARS = 6000;
const EMBED_DIM = 768; // text-embedding-004 output dimension

function client() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "your_key_here") {
    throw new Error(
      "GEMINI_API_KEY is required for embeddings. Add a free key from https://aistudio.google.com/apikey."
    );
  }
  return new GoogleGenerativeAI(key).getGenerativeModel({ model: EMBED_MODEL });
}

function clip(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

type EmbedModel = ReturnType<typeof client>;

async function embedBatch(model: EmbedModel, slice: string[]): Promise<number[][]> {
  const res = await model.batchEmbedContents({
    requests: slice.map((text) => ({
      content: { role: "user", parts: [{ text }] },
    })),
  });
  return res.embeddings.map((e) => e.values);
}

/**
 * Embed many texts. Returns one vector per input, in order. A failing batch is
 * retried item-by-item so a single oversized/odd chunk can't abort the whole
 * index; an item that still fails gets a zero vector (it simply won't match).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = client();
  const clipped = texts.map(clip);
  const vectors: number[][] = [];

  for (let i = 0; i < clipped.length; i += BATCH) {
    const slice = clipped.slice(i, i + BATCH);
    try {
      vectors.push(...(await embedBatch(model, slice)));
    } catch (batchErr) {
      console.error(
        `[embed] batch ${i}-${i + slice.length} failed, retrying item-by-item:`,
        batchErr
      );
      for (const text of slice) {
        try {
          const [v] = await embedBatch(model, [text]);
          vectors.push(v);
        } catch (itemErr) {
          console.error("[embed] item failed, using zero vector:", itemErr);
          vectors.push(new Array(EMBED_DIM).fill(0));
        }
      }
    }
  }
  return vectors;
}

/** Embed a single text (e.g. the user's task). */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
