import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shopItems } from "@/lib/server/shop";
import styles from "../../finds.module.css";
import { Tabs } from "../../tabs";
import { AdBar, Arrow, Chip, colors, family, Footer, Mark, newIds, slug } from "../../ui";

// One page per color: ivethskin.com/c/skincare. Newest find first, in rows.
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
      <div className={`${styles.wrap} ${styles.bar}`}>
        <Mark categories={categories} />
        <a className={styles.back} href="/">
          <Arrow /> All finds
        </a>
      </div>

      {categories.length > 1 && (
        <Tabs
          current={slug(category)}
          categories={categories.map((c) => ({ id: slug(c), label: family(c).tab, ...family(c) }))}
        />
      )}

      <main className={`${styles.wrap} ${styles.room}`} style={colors(category)} aria-labelledby="h-cat">
        <div className={styles.band}>
          <div>
            <h1 id="h-cat" className={styles.catTitle}>
              {category}
            </h1>
            <p>
              {mine.length} {mine.length === 1 ? "find" : "finds"}
            </p>
          </div>
        </div>
        <div className={styles.rows}>
          {mine.map((i) => (
            <Chip key={i.id} item={i} isNew={fresh.has(i.id)} />
          ))}
        </div>
      </main>

      <Footer categories={categories} />
    </>
  );
}
