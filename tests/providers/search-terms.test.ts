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
