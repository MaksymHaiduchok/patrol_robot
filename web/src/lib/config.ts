export const VISION_URL = process.env.NEXT_PUBLIC_VISION_URL ?? "http://localhost:8001";
export const VISION_STREAM_URL =
  process.env.NEXT_PUBLIC_VISION_STREAM_URL ?? `${VISION_URL}/stream`;
