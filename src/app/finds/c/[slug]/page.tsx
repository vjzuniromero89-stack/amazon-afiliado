import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shopItems } from "@/lib/server/shop";
import styles from "../../finds.module.css";
import { AdBar, Chip, colors, Footer, newIds, SiteHeader, slug } from "../../ui";

// One page per category: ivethskin.com/c/skincare. Newest find first.
export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

async function load(key: string) {
  const items = await shopItems();
  const category = [...new Set(items.map((i) => i.category))].find((c) => slug(c) === key);
  return category ? { items, category } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  if (!found) return { title: "Ivethskin Finds" };
  const mine = found.items.filter((i) => i.category === found.category);
  const title = `${found.category} finds · Ivethskin Finds`;
  const description = `${found.category}: ${mine.map((i) => i.short).join(", ")}. My own photos and the label details. #ad`;
  return {
    metadataBase: new URL("https://ivethskin.com"),
    alternates: { canonical: `/c/${slug(found.category)}` },
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/c/${slug(found.category)}`,
      siteName: "Ivethskin Finds",
      type: "website",
      images: mine[0] ? [`/finds/img/${mine[0].id}`] : [],
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { items, category } = found;
  const categories = [...new Set(items.map((i) => i.category))];
  const mine = items.filter((i) => i.category === category).sort((a, b) => b.added.localeCompare(a.added));
  const fresh = newIds(items);
  return (
    <>
      <AdBar />
      <SiteHeader categories={categories} current={slug(category)} />

      <main className={styles.wrap} aria-labelledby="h-cat">
        <div className={styles.banner} style={colors(category)}>
          <h1 id="h-cat">{category}</h1>
          <p>
            {mine.length} {mine.length === 1 ? "find" : "finds"}
          </p>
        </div>
        <div className={`${styles.grid} ${styles.light}`}>
          {mine.map((i) => (
            <Chip key={i.id} item={i} isNew={fresh.has(i.id)} />
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}
