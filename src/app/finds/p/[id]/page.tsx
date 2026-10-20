import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { shopItem } from "@/lib/server/shop";
import styles from "../../finds.module.css";
import { AdBar, Arrow, Chip, chipNo, colors, Footer, Mark, newIds, slug, STORE_LINK } from "../../ui";

// One find on its own page: every photo, the label facts and the store link.
// Served as ivethskin.com/p/<id> (the proxy rewrites it here).
export const revalidate = 600;

type Props = { params: Promise<{ id: string }> };

const valid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = valid(id) ? await shopItem(id) : null;
  if (!found) return { title: "Ivethskin Finds" };
  const { item } = found;
  const title = `${item.short} · Ivethskin Finds`;
  const description = [item.facts.join(", "), `My own photos and the label details. See it on ${item.store}. #ad`]
    .filter(Boolean)
    .join(". ");
  return {
    metadataBase: new URL("https://ivethskin.com"),
    alternates: { canonical: `/p/${item.id}` },
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/p/${item.id}`,
      siteName: "Ivethskin Finds",
      type: "website",
      images: [`/finds/img/${item.id}`],
    },
  };
}

export default async function FindPage({ params }: Props) {
  const { id } = await params;
  const found = valid(id) ? await shopItem(id) : null;
  if (!found) notFound();
  const { item, items } = found;
  const categories = [...new Set(items.map((i) => i.category))];
  const same = items.filter((i) => i.category === item.category && i.id !== item.id);
  const more = (same.length ? same : items.filter((i) => i.id !== item.id)).slice(0, 4);
  const fresh = newIds(items);
  const shots = Array.from({ length: Math.min(item.photos, 6) }, (_, n) => n + 1);

  return (
    <>
      <AdBar />
      <div className={`${styles.wrap} ${styles.bar}`}>
        <Mark categories={categories} />
        <a className={styles.back} href="/">
          <Arrow /> All finds
        </a>
      </div>

      <main className={styles.wrap}>
        <div className={styles.item} style={colors(item.category)}>
          <div className={styles.shots}>
            {shots.map((n) => (
              // Our own product photos, served by this site.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={n}
                src={`/finds/img/${item.id}${n > 1 ? `?n=${n}` : ""}`}
                alt={n === 1 ? item.title : `${item.short}, photo ${n}`}
                width={900}
                height={900}
                loading={n === 1 ? "eager" : "lazy"}
              />
            ))}
          </div>

          <section className={styles.panel} aria-labelledby="find-name">
            <h1 id="find-name">{item.short}</h1>
            <span className={styles.no}>
              {chipNo(item.no)} · <a href={`/c/${slug(item.category)}`}>{item.category}</a>
            </span>
            {item.title !== item.short && <p className={styles.full}>{item.title}</p>}
            {item.facts.length > 0 && (
              <div className={styles.callout}>
                <h2>On the label</h2>
                <ul className={styles.facts}>
                  {item.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            <a className={`${styles.go} ${styles.big}`} href={item.link} data-go={item.id} {...STORE_LINK}>
              See it on {item.store} <Arrow />
            </a>
            <p className={styles.note}>
              #ad · Affiliate link. It opens {item.store}, where you see the price and availability.
            </p>
          </section>
        </div>

        {more.length > 0 && (
          <section className={styles.more} aria-labelledby="more">
            <h2 id="more">{same.length ? `More in ${item.category}` : "More finds"}</h2>
            <div className={styles.grid}>
              {more.map((i) => (
                <Chip key={i.id} item={i} isNew={fresh.has(i.id)} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer categories={categories} />
    </>
  );
}
