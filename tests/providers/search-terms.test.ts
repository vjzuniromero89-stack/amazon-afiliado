import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTitle, searchTerms } from "../../src/lib/server/generation";
import type { Product } from "../../src/lib/types";

const product = (title: string, notes = "") => ({ title, category: "", notes }) as unknown as Product;
const phrase = (title: string, notes = "") => searchTerms(product(title, notes), parseTitle(title)).phrase;

test("a cream with hyaluronic acid is a moisturizer, never a supplement", () => {
  assert.equal(
    phrase(
      "Vanicream Daily Facial Moisturizer, Lightweight, Non-Greasy, 3 Fl Oz",
      "Vanicream Daily Facial Moisturizer with Hyaluronic Acid and 5 Key Ceramides",
    ),
    "Face Moisturizer",
  );
  assert.equal(phrase("Collagen Night Cream for Face"), "Face Moisturizer");
});

test("real pills keep their supplement phrase", () => {
  assert.equal(phrase("Vital Vitamins Hyaluronic Acid 120 Capsules"), "Hyaluronic Acid Supplement");
  assert.equal(phrase("Vital Vitamins Multi Collagen Complex"), "Collagen Supplement");
});

test("Pin details keep whole facts and drop promises", async () => {
  const { TemplateConceptProvider } = await import("../../src/lib/server/generation");
  const { defaults } = await import("../../src/lib/types");
  const p = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Vanicream Daily Facial Moisturizer, Lightweight, Non-Greasy, 3 Fl Oz",
    category: "Skincare",
    notes:
      "Vanicream Daily Facial Moisturizer with Hyaluronic Acid and 5 Key Ceramides, Vanicream Facial Moisturizer is formulated with hyaluronic acid and five essential ceramides, It helps restore skin’s natural barrier, while delivering lightweight, long-lasting moisture, Whether you wear makeup or not, the rich, and deeply moisturized, dyes",
    images: [],
    url: "https://www.amazon.com/dp/B0TEST",
  } as unknown as import("../../src/lib/types").Product;
  const out = await new TemplateConceptProvider().generate(p, [], defaults);
  for (const c of out) {
    assert.ok(!/restore/i.test(c.description), c.description);
    assert.ok(!/\bwea\.|dyes|the rich/.test(c.description), c.description);
    assert.ok(/five essential ceramides\./.test(c.description), c.description);
  }
});

test("short label facts still make the details", async () => {
  const { TemplateConceptProvider } = await import("../../src/lib/server/generation");
  const { defaults } = await import("../../src/lib/types");
  const p = {
    id: "00000000-0000-0000-0000-000000000002",
    title: "BEDLORE Waterproof Mattress Protector, Queen",
    category: "Home Decor & Organization",
    notes: "Waterproof, Queen Size, Noiseless, Deep Pocket",
    images: [],
    url: "https://www.amazon.com/dp/B0TEST2",
  } as unknown as import("../../src/lib/types").Product;
  const out = await new TemplateConceptProvider().generate(p, [], defaults);
  assert.ok(/Key details: Waterproof, Queen Size, Noiseless, Deep Pocket\./.test(out[0].description), out[0].description);
});

test("hair care and lip liner get their own phrase, never a vitamin one", () => {
  assert.equal(phrase("Pantene Pro-Vitamin Essence."), "Hair Treatment");
  assert.equal(phrase("L'Oreal Paris Colour Riche Lip Liner Pencil."), "Lip Liner");
});
