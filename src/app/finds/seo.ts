// Structured data (schema.org JSON-LD) for ivethskin.com. Only facts the
// page already shows: names, links, the logo and the public profiles. No
// Product markup: without a price Google treats it as incomplete, and the
// shop never shows prices.
export const SITE = "https://ivethskin.com";
export const SITE_NAME = "Ivethskin Finds";
const PROFILES = [
  "https://www.tiktok.com/@ivethskin",
  "https://www.instagram.com/ivethskin_/",
  "https://www.pinterest.com/karenivette_29/",
];

type Crumb = { name: string; path: string };

export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: SITE_NAME,
        url: `${SITE}/`,
        logo: `${SITE}/finds/icon-512.png`,
        sameAs: PROFILES,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        name: SITE_NAME,
        url: `${SITE}/`,
        inLanguage: "en-US",
        publisher: { "@id": `${SITE}/#org` },
      },
    ],
  };
}

export function breadcrumbs(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map((c, n) => ({
      "@type": "ListItem",
      position: n + 1,
      name: c.name,
      item: `${SITE}${c.path}`,
    })),
  };
}

// A category page: its finds in the order shown, each by its own page.
export function itemList(name: string, items: { id: string; short: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((i, n) => ({
      "@type": "ListItem",
      position: n + 1,
      name: i.short,
      url: `${SITE}/p/${i.id}`,
    })),
  };
}

// Safe inside <script>: "<" can never close the tag.
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
