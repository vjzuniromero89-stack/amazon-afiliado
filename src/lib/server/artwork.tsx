import "server-only";
import { ImageResponse } from "next/og";
import type { Creative, Settings } from "../types";
export interface ImageProvider {
  render(creative: Creative, settings: Settings): Promise<Uint8Array>;
}
export class VerticalTemplateProvider implements ImageProvider {
  async render(c: Creative, s: Settings) {
    const bold = c.template === "bold",
      minimal = c.template === "minimal";
    const bg = bold ? "#253f37" : minimal ? "#f5f1e8" : "#eadcc7",
      fg = bold ? "#f9f4e9" : "#253f37";
    const image = new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: bg,
            color: fg,
            padding: "90px 76px",
            fontFamily: "sans-serif",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 6 }}>
            THE EVERYDAY EDIT
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            <div
              style={{
                display: "flex",
                width: 110,
                height: 110,
                borderRadius: 100,
                background: bold ? "#d9edab" : "#b3c5a4",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 88,
                lineHeight: 1.04,
                letterSpacing: -4,
              }}
            >
              {c.title}
            </div>
            <div style={{ display: "flex", fontSize: 30, opacity: 0.7 }}>
              Pequeños descubrimientos.
              <br />
              Nuevas posibilidades.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 45 }}>
            <div
              style={{
                display: "flex",
                border: `2px solid ${fg}`,
                borderRadius: 60,
                padding: "24px 35px",
                fontSize: 29,
                alignSelf: "flex-start",
              }}
            >
              {c.cta} ↗
            </div>
            <div style={{ display: "flex", fontSize: 21, lineHeight: 1.4 }}>
              {s.disclosure}
            </div>
          </div>
        </div>
      ),
      { width: 1000, height: 1500 },
    );
    return new Uint8Array(await image.arrayBuffer());
  }
}
// Future image providers implement the same interface; preserve product identity,
// rights and disclosure, and store a versioned asset before approval.
export const imageProvider: ImageProvider = new VerticalTemplateProvider();
