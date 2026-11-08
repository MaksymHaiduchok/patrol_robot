export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const API_WS_URL = process.env.NEXT_PUBLIC_API_WS_URL ?? "ws://localhost:4000";
export const VISION_URL = process.env.NEXT_PUBLIC_VISION_URL ?? "http://localhost:8001";
export const VISION_STREAM_URL =
  process.env.NEXT_PUBLIC_VISION_STREAM_URL ?? `${VISION_URL}/stream`;
