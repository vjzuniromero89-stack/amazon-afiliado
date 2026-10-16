# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two people use it day to day: the owner (vjzuniromero) and Karen, whose Pinterest Business account (karenivette_29) publishes the Pins. Both create, review and approve Pins. Neither is a designer or developer; the interface is in Spanish.

## Product Purpose

A private web app that turns Amazon products into Pinterest Pins carrying the affiliate tracking ID (ivethskin-20). The user adds a product with its photos, the app writes a short English title and description, renders the Pin in one of three designs, and publishes it to a Pinterest board after human approval, spacing Pins at least 60 minutes apart. Success is Pins going out regularly without the user fighting the tool.

## Operating Context

- Amazon Associates US, tracking ID `ivethskin-20`; the first product is a collagen supplement.
- Pinterest developer app "ivethskin" (App ID 1617055), Trial access with `PINTEREST_SANDBOX=true`: Pins are only visible to the owner until Standard access is granted, which requires a 2-3 minute demo video of connect → create board → generate → publish.
- Hosted on Vercel (team edvickar) at amazon-afiliado-liard.vercel.app; data in Supabase project tkyqretgmnyeuqnihipl.
- Workflow: Products → Pin Studio → Approval Queue → Scheduler → Published, with Settings for connections and Analytics/AI Insights for results.

## Capabilities and Constraints

- Human review before publishing is on by default; "Aprobar y publicar" publishes now or queues to respect the minimum interval.
- Pin text is in English for a US audience; the app's own interface is Spanish.
- Delete actions exist for Pins and products.
- No real analytics yet: Pinterest metrics only appear after publishing; never show invented numbers.

## Brand Commitments

- Visual direction chosen by the user (2026-10-16): navy blue header and sidebar, orange primary buttons, light grey page background, white cards with visible borders. Replaces the earlier pale green-on-white look, which the user found hard to read.
- Text at least 16 px; bold, clearly larger headings.

## Evidence on Hand

No testimonials, metrics or customers. Product photos come from what the user uploads.

## Product Principles

1. Readable first: large text, strong contrast, visible edges on every control and card.
2. The user always approves before anything reaches Pinterest.
3. Show real state only: connected or not, queued or published, never simulated numbers.
4. One clear next step per screen.

## Accessibility & Inclusion

The user reported difficulty reading small, low-contrast text on white. Body text 16 px minimum, WCAG AA contrast at least, borders on inputs and cards, focus outlines visible.
