import { ImageResponse } from "next/og";
import { SocialCard } from "./brand";

export const alt = "AgentShield: stop the agent before it signs the drain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<SocialCard />, size);
}
