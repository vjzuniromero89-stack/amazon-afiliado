export type Mode = "manual" | "assisted" | "autopilot";
export type Product = {
  id: string;
  user_id: string;
  // "amazon" (default), "target" or "walmart".
  store?: string | null;
  // Amazon ASIN, or T/W + the Target or Walmart product number.
  asin: string;
  marketplace: string;
  url: string;
  title: string;
  category: string;
  notes: string;
  images?: string[];
  // The product's video for Reels (bucket "product-videos").
  video_path?: string | null;
  created_at: string;
};
// A video in the "Fotos" > "Videos" library; url plays it for an hour.
export type Video = {
  id: string;
  path: string;
  name: string;
  product_id: string | null;
  created_at: string;
  url: string | null;
};
// A photo in the "Fotos" library, reusable across products.
export type Photo = {
  id: string;
  user_id: string;
  path: string;
  name: string;
  category: string;
  created_at: string;
};
export type Board = {
  id: string;
  user_id: string;
  pinterest_id: string;
  name: string;
  // Boards that no longer exist on the connected Pinterest (e.g. Sandbox ones).
  archived?: boolean;
};
export type Creative = {
  id: string;
  user_id: string;
  product_id: string;
  campaign_id: string | null;
  title: string;
  description: string;
  keywords: string[];
  alt_text: string;
  cta: string;
  board_id: string | null;
  template: string;
  status: "draft" | "approved" | "rejected" | "queued" | "published";
  revision: number;
  created_at: string;
};
export type QueueItem = {
  id: string;
  creative_id: string;
  user_id: string;
  scheduled_at: string;
  status:
    | "pending"
    | "processing"
    | "published"
    | "failed"
    | "uncertain"
    | "cancelled";
  error: string | null;
  attempts: number;
  started_at: string | null;
};
export type Publication = {
  id: string;
  user_id: string;
  creative_id: string;
  product_id: string;
  board_id: string;
  template: string;
  pinterest_id: string;
  published_at: string;
};
export type Metric = {
  publication_id: string;
  date: string;
  impressions: number | null;
  saves: number | null;
  outbound_clicks: number | null;
  fetched_at: string;
};
export type Settings = {
  user_id?: string;
  mode: Mode;
  require_approval: boolean;
  daily_limit: number;
  min_interval_minutes: number;
  tracking_id: string;
  marketplace: string;
  storefront_url: string;
  disclosure: string;
  default_board_id: string | null;
  timezone: string;
  autopilot_enabled: boolean;
};
export type Campaign = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
};
export type Audit = {
  id: string;
  action: string;
  created_at: string;
  detail: Record<string, unknown>;
};
export type Snapshot = {
  products: Product[];
  photos: Photo[];
  videos: Video[];
  creatives: Creative[];
  boards: Board[];
  queue: QueueItem[];
  publications: Publication[];
  metrics: Metric[];
  campaigns: Campaign[];
  audit: Audit[];
  settings: Settings;
  connected: boolean;
  instagram: { username: string } | null;
  // Taps on ivethskin.com store buttons in the last 30 days.
  clicks: { total: number; byProduct: Record<string, number>; bySource: Record<string, number> };
  reels: { product_id: string; status: string; permalink: string | null; error: string | null; scheduled_at: string }[];
  configured: boolean;
  email: string | null;
  aiEnabled: boolean;
};
export const defaults: Settings = {
  mode: "assisted",
  require_approval: true,
  daily_limit: 5,
  min_interval_minutes: 60,
  tracking_id: "",
  marketplace: "www.amazon.com",
  storefront_url: "",
  disclosure:
    "As an Amazon Associate I earn from qualifying purchases. #ad",
  default_board_id: null,
  timezone: "America/New_York",
  autopilot_enabled: false,
};
