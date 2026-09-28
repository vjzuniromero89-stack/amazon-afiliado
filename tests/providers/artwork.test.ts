import { test } from "node:test";
import assert from "node:assert/strict";
import { VerticalTemplateProvider } from "../../src/lib/server/artwork";
import {
  TemplateConceptProvider,
  OpenAIConceptProvider,
} from "../../src/lib/server/generation";
import { defaults, type Creative, type Product } from "../../src/lib/types";
const product = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Una lámpara de escritorio",
  category: "Hogar",
  notes: "Acabado de madera.",
  asin: "B012345678",
} as Product;
test("template generation produces three distinct validated concepts without invented prices", async () => {
  const concepts = await new TemplateConceptProvider().generate(
    product,
    [],
    defaults,
  );
  assert.equal(concepts.length, 3);
  assert.equal(new Set(concepts.map((c) => c.title)).size, 3);
  assert.equal(new Set(concepts.map((c) => c.template)).size, 3);
  assert.ok(
    concepts.every(
      (c) =>
        c.description.includes(product.notes) && !c.description.includes("$"),
    ),
  );
});
test("artwork produces real PNG bytes at 1000 × 1500 for all three templates", async () => {
  const concepts = await new TemplateConceptProvider().generate(
    product,
    [],
    defaults,
  );
  for (const c of concepts) {
    const bytes = await new VerticalTemplateProvider().render(
      c as Creative,
      defaults,
    );
    const png = Buffer.from(bytes);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), 1000);
    assert.equal(png.readUInt32BE(20), 1500);
    assert.ok(png.length > 10000);
  }
});
test("AI provider rejects invalid output instead of persisting unchecked concepts", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ concepts: [{ title: "Invalid" }] }),
          },
        },
      ],
    });
  try {
    await assert.rejects(
      new OpenAIConceptProvider().generate(product, [], defaults),
    );
  } finally {
    globalThis.fetch = original;
  }
});
