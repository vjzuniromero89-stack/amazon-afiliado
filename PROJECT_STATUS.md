# PROJECT_STATUS — Amazon Affiliate Command / Ivethskin
Updated: 2026-10-21. Base audited: 57639989cdd1ae797bd6ed4ea94d58dac2fbd6ad.
Branch: codex/ivethskin-audit-20261021. Do not merge or deploy production without review.

## Verified scope
- GitHub repository vjzuniromero89-stack/amazon-afiliado; Vercel project prj_HJz4db2xVwIR7ljyqsFdEBOQvpit (amazon-afiliado), team edvickar.
- Production READY at the audited commit. ivethskin.com is assigned to this project; live home returned 200 and displayed 21 finds across six categories.
- This is the existing public catalog. Preserve domain, branding, categories, private workspace and approval flow.
- README and PRODUCT.md contain historical V1 details: do not use them as proof of current integration state.
- Account authorization/token validity, real publication success and Pinterest Standard vs Sandbox status were NOT verified. PRODUCT.md mentions Sandbox historically; check the actual setting before diagnosing low reach.

## Integrations verified in source
| Channel | Implemented | Limits / unresolved |
| --- | --- | --- |
| Pinterest | OAuth, boards, POST /pins, approved scheduled queue, daily analytics | Live account access not tested; worker publishes at most one due Pin per account/run |
| Instagram | OAuth, photos, carousels and Reels; media creation and media_publish | Up to 3 due rows/run; existing account connection not verified |
| Facebook | OAuth, Page feed links and Reels | Up to 3 due rows/run; existing Page authorization not verified |
| TikTok | Public profile link | No TikTok publishing API found; manual publishing |
| Amazon | Tagged outbound product links | No orders/commission import found; Creators adapter explicitly unimplemented |

Evidence: src/lib/server/{pinterest,operations,instagram,facebook,generation}.ts; src/app/api/cron/route.ts.

## Prioritized audit
1. **P1 scheduling reliability:** vercel.json is still 0 12 * * * (daily, UTC). The deployed commit matches this configuration. Cron now invokes Instagram and Facebook as well as Pinterest. Scheduled times can wait until the next daily execution. No runtime cron execution logs were verified. Inspect Meta workers for atomic claims, concurrency and uncertain POST recovery before increasing frequency: their SELECT pending/processing plus external writes warrants concurrency testing. Do not simply switch to every 15 minutes or enable new autopublishing.
2. **P1 measurement:** Pinterest analytics and shop_clicks already exist. Website clicks are not purchases, unique people or Amazon-confirmed clicks. The first referral source was overwritten on later external visits and aliases fragmented channels. This branch normalizes common social hosts/aliases and preserves first nonempty source per tab session, including a storage-disabled fallback. Existing historical records are unchanged.
3. **P1 disclosures:** home top/footer already identify Amazon affiliation; product page had #ad/affiliate-link text. This branch adds plain commission language beside every card CTA and strengthens product-page wording. This is an improvement, not a certification of every post/account.
4. **P2 discovery/content:** homepage, category and product titles, descriptions, canonical URLs, Open Graph, robots and sitemap exist. Category descriptions concatenate every product and can become unwieldy; some products have no facts. Add reviewed category introductions and useful factual product details; avoid empty generic SEO pages. Keep direct Amazon links and sponsored/nofollow attributes. No measured speed/Core Web Vitals audit yet.
5. **P2 UX:** category navigation and product routes were inspected. Responsive CSS exists (600/720/900px rules); a dedicated mobile viewport test remains pending. A public product navigation visibly showed the private Spanish loading screen; this branch adds an English public loading boundary. Public content is English inside an English wrapper, while root HTML is Spanish.
6. **P2 honesty:** public copy says photos are the owner's, while generated Meta captions always label media AI-made and the carousel says favorites. Confirm provenance and personal opinions per asset/product; avoid blanket assertions. The text generator explicitly prohibits invented benefits/results, but source facts and manually edited posts still require review.

## Initial implemented changes
- Clear commission notice near each card and on product detail.
- Social source normalization and preservation of first nonempty session source; no changes to affiliate tags, destination URLs or database.
- English loading boundary for the existing public shop.
- Regression tests for referral normalization/privacy.
- README status pointer and this audit/handoff.

## Amazon results proposal (not implemented)
Use reports downloaded by the owner from Associates Central; do not scrape the account or request its password. Start with actual sample headers/formats before writing an importer.
- Create approved tracking IDs inside Associates Central for distinct channels/campaigns, then explicitly configure their mapping. Do not invent IDs or silently replace existing ivethskin-20.
- Import private aggregate reports by period, tracking ID and currency; distinguish ordered vs shipped items, returns, revenue and commissions.
- Deduplicate overlapping imports and display report coverage/timezone. Keep source file digest and import date; no customer identities.
- Compare channel-level Pinterest/website activity with Amazon totals for the same reporting period. Do not claim a particular visitor or Pin caused an order unless the reporting dimension supports it.
- Current shared tag cannot retrospectively identify which social channel produced an order. Website referrer attribution alone does not establish Amazon purchase attribution.

## Reusable content plan (not implemented)
Use one verified product brief: exact title, approved facts, owned/licensed assets, public product URL and disclosure.
| Channel | Proposed output | CTA |
| --- | --- | --- |
| Pinterest | 1000x1500 image, descriptive search title, description, alt text | Open matching product/details link |
| Instagram Reels | 1080x1920 demo script: show product, show verified feature, close; disclosure in video and caption | Matching item on ivethskin.com via profile |
| TikTok | Adapted vertical demo with spoken/on-screen disclosure | Matching item via available profile link; manual publishing |
| Facebook | Link post or vertical Reel, factual caption and disclosure | Matching Ivethskin product URL |

These are editorial output targets, not claims about API upload limits. Never fabricate usage, reviews, outcomes, prices or availability. Do not automatically publish exported drafts. Use distinct utm_source values on Ivethskin links where the channel supports clickable URLs.

## English / Spanish
Pilot human-reviewed Spanish content for a small set of existing products and social posts; measure demand before translating the whole catalog. If adding /es routes later, add reciprocal hreflang, correct document language, localized disclosures and a language switch. Preserve current English URLs and domain; no auto-redirect by inferred ethnicity/location.

## Policies reviewed 2026-10-21
- Amazon disclosure: https://affiliate-program.amazon.com/help/node/topic/GHQNZAU6669EZS98
- Amazon reports: https://affiliate-program.amazon.com/help/node/topic/GMWAK55DQX8JEK7C
- Amazon downloads: https://affiliate-program.amazon.com/help/node/topic/GF4ZWWG8EYT5TNR2
- Amazon tracking IDs: https://affiliate-program.amazon.com/help/node/topic/GK5TZZ4AWML2QSLA
- FTC: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking
- Pinterest affiliates: https://policy.pinterest.com/en/commercial-and-branded-content-guidelines
Disclosures should accompany the recommendation; video needs disclosure in the video, not only its description. Maintain original useful content, avoid repetitive/spam distribution, and review product claims. Pinterest merchant/catalog eligibility is distinct from permission to publish affiliate Pins; do not promise merchant approval.

## Validation and next handoff
- npm run typecheck: passed.
- npm test launcher hit local IPC EPERM; equivalent node --import tsx --test tests/*.test.ts: 24 passed, 0 failed.
- npm run build: compilation and TypeScript passed; prerender stopped because this local environment lacks NEXT_PUBLIC_SUPABASE_URL. No production credentials were copied.
- Vercel Preview dpl_CVVMMY2WAVtFiuJzN6tLUs3owdHe for commit 1157d0380fd9965f2f242756ef8e836a67506670: ERROR. Compilation and TypeScript passed; prerender failed with 'Falta configurar NEXT_PUBLIC_SUPABASE_URL en el servidor.' The allocated preview is not working. Configure an isolated test database/environment for Preview, then redeploy this branch. Do not copy production credentials merely to make the build pass. PR #2 remains draft: https://github.com/vjzuniromero89-stack/amazon-afiliado/pull/2 .
- No social posts sent, database migrations applied, cron changed, or production release performed.
- Next: validate preview/mobile; verify Pinterest Sandbox/Standard and actual connected accounts privately; then harden Meta queue claims before any cron increase. Obtain an Amazon report sample before implementing import.
