import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { Creative, Settings } from "../types";

export interface ImageProvider {
  render(
    creative: Creative,
    settings: Settings,
    photo?: string,
  ): Promise<Uint8Array>;
}

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
};
let fontCache: Promise<Font[]> | null = null;
function fonts() {
  const dir = path.join(process.cwd(), "src/lib/server/fonts");
  const load = async (file: string) => {
    const b = await readFile(path.join(dir, file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  };
  fontCache ??= Promise.all([
    load("PlayfairDisplay-SemiBold.ttf"),
    load("Montserrat-Medium.ttf"),
    load("Montserrat-Bold.ttf"),
    load("GreatVibes.ttf"),
  ]).then(([play, mont, montBold, script]) => [
    { name: "Playfair", data: play, weight: 600, style: "normal" },
    { name: "Montserrat", data: mont, weight: 500, style: "normal" },
    { name: "Montserrat", data: montBold, weight: 700, style: "normal" },
    { name: "Script", data: script, weight: 400, style: "normal" },
  ]);
  return fontCache;
}

// "Wellness Find: Collagen Peptides" -> hook "Wellness Find", title "Collagen Peptides"
function split(title: string) {
  const i = title.indexOf(": ");
  return i > 0 && i < 30
    ? { hook: title.slice(0, i), main: title.slice(i + 2) }
    : { hook: "", main: title };
}
const size = (t: string, big: number, mid: number, small: number) =>
  t.length > 50 ? small : t.length > 30 ? mid : big;

function PhotoEditorial({ c, s, photo }: { c: Creative; s: Settings; photo: string }) {
  const { hook, main } = split(c.title);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#c99a86", color: "#fff", padding: "70px 60px 50px", alignItems: "center" }}>
      <div style={{ display: "flex", fontFamily: "Playfair", fontSize: size(main, 92, 76, 62), lineHeight: 1.05, textAlign: "center", justifyContent: "center", letterSpacing: -1 }}>
        {main}
      </div>
      <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: 24, letterSpacing: 7, marginTop: 22, textTransform: "uppercase" }}>
        {hook || "Amazon find worth saving"}
      </div>
      <div style={{ display: "flex", flex: 1, width: "100%", marginTop: 40, background: "#fffaf6", borderRadius: 36, padding: 40, alignItems: "center", justifyContent: "center" }}>
        <img src={photo} width={800} height={800} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", marginTop: 36, background: "#fff", color: "#5b3a2e", fontFamily: "Montserrat", fontWeight: 700, fontSize: 30, padding: "20px 44px", borderRadius: 60 }}>
        {c.cta}
      </div>
      <div style={{ display: "flex", fontFamily: "Montserrat", fontSize: 19, marginTop: 22, opacity: 0.9 }}>
        {s.disclosure}
      </div>
    </div>
  );
}

function PhotoMinimal({ c, s, photo }: { c: Creative; s: Settings; photo: string }) {
  const { hook, main } = split(c.title);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f6f0e7" }}>
      <img src={photo} width={1000} height={900} style={{ width: 1000, height: 900, objectFit: "cover" }} />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "50px 70px 45px", color: "#2f3b33" }}>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: 24, letterSpacing: 8, color: "#a0694f", textTransform: "uppercase" }}>
          {hook || "Amazon Find"}
        </div>
        <div style={{ display: "flex", fontFamily: "Playfair", fontSize: size(main, 80, 66, 54), lineHeight: 1.08, marginTop: 18 }}>
          {main}
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: 28, borderBottom: "3px solid #2f3b33", paddingBottom: 6 }}>
            {c.cta}
          </div>
        </div>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontSize: 18, marginTop: 24, opacity: 0.7 }}>
          {s.disclosure}
        </div>
      </div>
    </div>
  );
}

function PhotoBold({ c, s, photo }: { c: Creative; s: Settings; photo: string }) {
  const { hook, main } = split(c.title);
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: "#1d1d1d" }}>
      <img src={photo} width={1000} height={1500} style={{ position: "absolute", top: 0, left: 0, width: 1000, height: 1500, objectFit: "cover" }} />
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 1000, height: 1500, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.88) 100%)" }} />
      <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 0, bottom: 0, width: 1000, padding: "0 70px 55px", color: "#fff" }}>
        <div style={{ display: "flex", fontFamily: "Script", fontSize: 150, lineHeight: 1 }}>
          {hook || "Amazon Find"}
        </div>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: size(main, 54, 46, 38), lineHeight: 1.15, letterSpacing: 2, textTransform: "uppercase", marginTop: 20 }}>
          {main}
        </div>
        <div style={{ display: "flex", marginTop: 36 }}>
          <div style={{ display: "flex", border: "3px solid #fff", borderRadius: 60, padding: "18px 40px", fontFamily: "Montserrat", fontWeight: 700, fontSize: 28 }}>
            {c.cta}
          </div>
        </div>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontSize: 18, marginTop: 26, opacity: 0.85 }}>
          {s.disclosure}
        </div>
      </div>
    </div>
  );
}

// Used when the product has no photos yet.
function TextOnly({ c, s }: { c: Creative; s: Settings }) {
  const bold = c.template === "bold",
    minimal = c.template === "minimal";
  const bg = bold ? "#253f37" : minimal ? "#f5f1e8" : "#eadcc7",
    fg = bold ? "#f9f4e9" : "#253f37";
  const { hook, main } = split(c.title);
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: bg, color: fg, padding: "90px 76px", justifyContent: "space-between" }}>
      <div style={{ display: "flex", fontFamily: "Montserrat", fontWeight: 700, fontSize: 24, letterSpacing: 7, textTransform: "uppercase" }}>
        {hook || "Amazon Find"}
      </div>
      <div style={{ display: "flex", fontFamily: "Playfair", fontSize: size(main, 96, 80, 66), lineHeight: 1.06 }}>
        {main}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", border: `2px solid ${fg}`, borderRadius: 60, padding: "22px 36px", fontFamily: "Montserrat", fontWeight: 700, fontSize: 29, alignSelf: "flex-start" }}>
          {c.cta}
        </div>
        <div style={{ display: "flex", fontFamily: "Montserrat", fontSize: 20 }}>
          {s.disclosure}
        </div>
      </div>
    </div>
  );
}

export class VerticalTemplateProvider implements ImageProvider {
  async render(c: Creative, s: Settings, photo?: string) {
    const body = !photo ? (
      <TextOnly c={c} s={s} />
    ) : c.template === "bold" ? (
      <PhotoBold c={c} s={s} photo={photo} />
    ) : c.template === "minimal" ? (
      <PhotoMinimal c={c} s={s} photo={photo} />
    ) : (
      <PhotoEditorial c={c} s={s} photo={photo} />
    );
    const image = new ImageResponse(body, {
      width: 1000,
      height: 1500,
      fonts: await fonts(),
    });
    return new Uint8Array(await image.arrayBuffer());
  }
}
export const imageProvider: ImageProvider = new VerticalTemplateProvider();
