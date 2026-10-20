"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Camera,
  Film,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  CircleHelp,
  Compass,
  ExternalLink,
  ImageOff,
  ImagePlus,
  Images,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  aggregate,
  breakdown,
  CATEGORIES,
  cleanProductName,
  detectCategory,
  insights,
  suggestDetails,
  marketplaces,
  reviewPin,
  STORES,
  storeDisclosure,
  storeOf,
  type StoreId,
} from "@/lib/domain";
import type { Creative, Photo, Product, Settings, Snapshot } from "@/lib/types";
type Upload = (productId: string | null, file: File) => Promise<boolean>;

export const sections = [
  "dashboard",
  "products",
  "fotos",
  "discover",
  "pin-studio",
  "approval-queue",
  "scheduler",
  "published",
  "analytics",
  "ai-insights",
  "settings",
];
const navigation = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "fotos", label: "Fotos", icon: Images },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "pin-studio", label: "Pin Studio", icon: WandSparkles },
  { id: "approval-queue", label: "Approval Queue", icon: ListChecks },
  { id: "scheduler", label: "Scheduler", icon: CalendarDays },
  { id: "published", label: "Published", icon: Send },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "ai-insights", label: "AI Insights", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const titles: Record<string, [string, string]> = {
  dashboard: [
    "Tu próximo gran Pin empieza aquí.",
    "De un descubrimiento a una publicación. Todo en un solo lugar.",
  ],
  products: [
    "Tu selección, con intención.",
    "Organiza productos de Amazon y conviértelos en nuevas ideas.",
  ],
  fotos: [
    "Tu biblioteca de fotos.",
    "Guarda aquí tus fotos y elígelas al añadir un producto.",
  ],
  discover: [
    "Encuentra tu próxima idea.",
    "Empieza con una selección propia. Amplía el descubrimiento cuando conectes Creators API.",
  ],
  "pin-studio": [
    "Ideas que merecen guardarse.",
    "Crea, edita y da forma a tu próximo Pin.",
  ],
  "approval-queue": [
    "Tu criterio marca la diferencia.",
    "Revisa cada detalle antes de dar luz verde.",
  ],
  scheduler: [
    "Un buen ritmo, sin improvisar.",
    "Programa Pins aprobados y mantén el control de tu calendario.",
  ],
  published: [
    "Tus ideas ya están ahí fuera.",
    "Un registro de cada publicación confirmada por Pinterest.",
  ],
  analytics: [
    "Menos suposiciones. Más señales.",
    "Resultados importados de Pinterest, sin métricas simuladas.",
  ],
  "ai-insights": [
    "Convierte datos en decisiones.",
    "Recomendaciones explicables, basadas en tu rendimiento observado.",
  ],
  settings: [
    "Un espacio a tu medida.",
    "Conecta tus cuentas y define cómo quieres trabajar.",
  ],
};
const statusLabels: Record<string, string> = {
  draft: "Por revisar",
  approved: "Aprobado",
  rejected: "Rechazado",
  queued: "Programado",
  published: "Publicado",
  pending: "En cola",
  processing: "Publicando",
  failed: "Fallido",
  uncertain: "Revisar resultado",
  cancelled: "Cancelado",
};
const number = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("es").format(n);
type Run = (
  body: Record<string, unknown>,
  message?: string,
) => Promise<boolean>;
const FeedbackContext = createContext<{ text: string; error: boolean } | null>(
  null,
);

function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>{statusLabels[status] || status}</span>
  );
}
function Empty({
  icon: Icon = Package,
  title,
  children,
  action,
}: {
  icon?: typeof Package;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const feedback = useContext(FeedbackContext);
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  // The dialog element also covers its own padding, so "target is the
  // dialog" is not "outside". Close only when the press started and ended
  // outside the box: a quick drag or a text selection never closes it.
  const outside = (e: React.MouseEvent<HTMLDialogElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={close}
      onMouseDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget && outside(e);
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget && outside(e)) close();
        pressedOutside.current = false;
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="Cerrar" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {feedback?.error && (
        <div className="notice error" role="alert">
          {feedback.text}
        </div>
      )}
      {children}
    </dialog>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Workspace({
  section,
  data,
}: {
  section: string;
  data: Snapshot;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
      null,
    ),
    [modal, setModal] = useState<string | null>(null),
    [mobile, setMobile] = useState(false),
    [editing, setEditing] = useState<Creative | null>(null),
    [scheduling, setScheduling] = useState<Creative | null>(null),
    [search, setSearch] = useState("");
  useEffect(() => {
    const ig = new URLSearchParams(window.location.search).get("instagram");
    if (ig)
      setNotice({
        text:
          ig === "success"
            ? "Instagram conectado. Los productos con video saldrán como Reel cuando salga su primer Pin."
            : "No se pudo conectar Instagram. Revisa la app de Meta (Instagram tester y la URL de retorno).",
        error: ig !== "success",
      });
  }, []);
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get(
      "connection",
    );
    if (status)
      setNotice({
        text:
          status === "success"
            ? "Pinterest conectado. Sincroniza tus boards en Settings."
            : "No se pudo completar OAuth. Verifica las variables, el callback y los permisos de la app.",
        error: status !== "success",
      });
  }, []);
  const ready = data.configured && !!data.email;
  const run: Run = async (body, message = "Cambios guardados") => {
    if (!ready) {
      setNotice({
        text: data.configured
          ? "Inicia sesión para continuar."
          : "Configura las variables de Supabase siguiendo el README para activar tu espacio.",
        error: true,
      });
      return false;
    }
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      let text = message;
      if (body.action === "publishDue")
        text =
          json.result?.status === "published"
            ? "Pin publicado en Pinterest."
            : json.result?.status === "idle"
              ? "No hay Pins listos para publicar. Revisa la fecha y los límites."
              : "El trabajo requiere atención. Consulta Scheduler.";
      if (body.action === "addVideo" && !body.product_id && json.result?.assigned)
        text = `Video guardado y asignado a «${json.result.assigned}». Sale como Reel cuando salga su primer Pin.`;
      if (body.action === "approveOne")
        text = json.result?.scheduled_at
          ? `Pin aprobado. Saldrá el ${new Date(json.result.scheduled_at).toLocaleString("es", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone: data.settings.timezone || "America/New_York",
            })}.`
          : "Pin aprobado. Se programa solo cuando le toque (1 por producto al día, máximo por día).";
      if (body.action === "approve") {
        if (json.result?.published) text = "¡Listo! El Pin ya está publicado en tu Pinterest.";
        else if (json.result?.scheduled_at)
          text = `Pin aprobado. Para no parecer spam, Pinterest necesita un espacio de ${data.settings.min_interval_minutes} min entre Pins: saldrá solo el ${new Date(
            json.result.scheduled_at,
          ).toLocaleString("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone: data.settings.timezone || "America/New_York",
          })}.`;
        else if (json.result?.warning)
          text = `Pin aprobado, pero no se publicó: ${json.result.warning}`;
      }
      setNotice({ text, error: false });
      router.refresh();
      return true;
    } catch (e) {
      setNotice({
        text:
          e instanceof Error ? e.message : "No se pudo completar la operación.",
        error: true,
      });
      return false;
    } finally {
      setPending(false);
    }
  };
  // Videos go straight to storage with a signed link (too big for the API).
  // With a product the video is also assigned to it; without one it only
  // joins the library ("Fotos" > "Videos").
  const uploadVideo: Upload = async (productId, file) => {
    if (file.size > 100 * 1024 * 1024) {
      setNotice({ text: `«${file.name}» pesa más de 100 MB.`, error: true });
      return false;
    }
    setPending(true);
    setNotice({ text: `Subiendo «${file.name}»…`, error: false });
    const product = productId ? { product_id: productId } : {};
    let path = "";
    try {
      const r = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "videoUploadUrl", type: file.type, ...product }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const up = await fetch(j.result.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!up.ok) throw new Error("No se pudo subir el video. Inténtalo de nuevo.");
      path = j.result.path;
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : "No se pudo subir el video.", error: true });
      return false;
    } finally {
      setPending(false);
    }
    return run(
      { action: "addVideo", path, name: file.name, ...product },
      !productId
        ? "Video guardado. No encontré su producto por el nombre del archivo: elígelo abajo."
        : data.instagram
          ? "Video guardado. Sale como Reel en Instagram cuando salga el primer Pin del producto."
          : "Video guardado. Conecta Instagram en Settings para publicarlo como Reel.",
    );
  };
  const auth = async (
    action: "login" | "logout",
    email?: string,
    password?: string,
  ) => {
    setPending(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, password }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error);
      setModal(null);
      router.refresh();
    } catch (e) {
      setNotice({
        text: e instanceof Error ? e.message : "Error de acceso.",
        error: true,
      });
    } finally {
      setPending(false);
    }
  };
  const draftCount = data.creatives.filter((c) => c.status === "draft").length;
  const metrics = aggregate(
    data.metrics.filter(
      (m) =>
        m.date >=
        new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    ),
  );
  const header = navigation.find((n) => n.id === section)!;
  function edit(c: Creative) {
    setEditing(c);
    setModal("edit");
  }
  // Versioned so the browser can keep each Pin image until it changes.
  const artworkSrc = (c: Creative) =>
    `/api/artwork/${c.id}?v=${c.revision}-${artworkKey(c)}`;
  const artworkKey = (c: Creative) => {
    const p = data.products.find((x) => x.id === c.product_id);
    return shortHash(
      "d2" + (p?.images || []).join("|") + (p?.notes || "") + (p?.category || "") + data.settings.disclosure,
    );
  };
  // The next Pin to go out and today's Pins (New York day), shown on the
  // dashboard and the scheduler so it is always clear what comes next.
  const tz = data.settings.timezone;
  const dayOf = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  // "5:16 p. m.", easier to read than "17:16".
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString("es", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: tz,
    });
  const todayKey = dayOf(new Date().toISOString());
  const nextJob = data.queue
    .filter((q) => ["pending", "processing"].includes(q.status))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const todayJobs = data.queue
    .filter((q) => q.status !== "cancelled" && dayOf(q.scheduled_at) === todayKey)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const creativeOf = (id: string) => data.creatives.find((c) => c.id === id);
  const nextCreative = nextJob && creativeOf(nextJob.creative_id);
  const todayPanel = (
    <section className="panel today-panel">
      <div className="panel-heading">
        <h2>Siguiente Pin</h2>
        <span className="subtle-pill">
          HOY · {todayJobs.filter((q) => q.status === "published").length}{" "}
          PUBLICADOS ·{" "}
          {todayJobs.filter((q) => q.status !== "published").length} EN COLA ·
          MÁXIMO {data.settings.daily_limit}
        </span>
      </div>
      {nextJob && nextCreative ? (
        <div className="next-pin">
          <Image
            unoptimized
            src={artworkSrc(nextCreative)}
            width={1000}
            height={1500}
            alt={nextCreative.alt_text}
          />
          <div>
            <small>
              {data.products.find((x) => x.id === nextCreative.product_id)?.title}
            </small>
            <h3>{nextCreative.title}</h3>
            <p>
              <b>
                {dayOf(nextJob.scheduled_at) === todayKey
                  ? "Hoy"
                  : new Date(nextJob.scheduled_at).toLocaleDateString("es", {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      timeZone: tz,
                    })}{" "}
                a las {timeOf(nextJob.scheduled_at)}
              </b>{" "}
              · {data.boards.find((b) => b.id === nextCreative.board_id)?.name}
            </p>
            <p className="muted">
              Sale con la siguiente pasada del reloj (cada 15 minutos).
            </p>
          </div>
        </div>
      ) : (
        <p className="muted">No hay Pins en cola.</p>
      )}
      {todayJobs.length > 0 && (
        <>
        <p className="today-date">
          Hoy,{" "}
          {new Date().toLocaleDateString("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: tz,
          })}{" "}
          (hora de Nueva York)
        </p>
        <ol className="today-list">
          {todayJobs.map((q) => (
            <li key={q.id} className={q.id === nextJob?.id ? "is-next" : ""}>
              <b>{timeOf(q.scheduled_at)}</b>
              <span>{creativeOf(q.creative_id)?.title || "Pin"}</span>
              <Badge status={q.status} />
            </li>
          ))}
        </ol>
        </>
      )}
    </section>
  );
  const cards = (items: Creative[]) =>
    items.length ? (
      <div className="creative-grid">
        {items.map((c) => (
          <article key={c.id} className="creative-card">
            <div className="creative-image">
              <Image
                unoptimized
                src={artworkSrc(c)}
                width={1000}
                height={1500}
                alt={c.alt_text}
              />
              <Badge status={c.status} />
            </div>
            <div className="creative-info">
              <small>
                {data.products.find((p) => p.id === c.product_id)?.title} ·{" "}
                {c.template}
              </small>
              <h3>{c.title}</h3>
              <p>{c.description}</p>
              <div className="keyword-row">
                {c.keywords.slice(0, 3).map((k, i) => (
                  <span key={i}>{k}</span>
                ))}
              </div>
              <p className="disclosure-line">
                {storeDisclosure(
                  storeOf(data.products.find((x) => x.id === c.product_id) || {}),
                  data.settings.disclosure,
                )}
              </p>
              <p className="board-line">
                Board:{" "}
                {data.boards.find((b) => b.id === c.board_id)?.name ||
                  "Se elige solo al aprobar"}
              </p>
              {["draft", "rejected", "approved"].includes(c.status) &&
                (() => {
                  // The app's own check; most problems were already repaired
                  // when the Pin was made, so this is usually a green tick.
                  const issues = reviewPin(
                    c,
                    data.products.find((x) => x.id === c.product_id),
                  );
                  return issues.length ? (
                    <p className="review-warn">⚠ Revisar: {issues.join(" ")}</p>
                  ) : (
                    <p className="review-ok">✓ Revisado por la app</p>
                  );
                })()}
              <div className="card-actions">
                {["draft", "rejected"].includes(c.status) && (
                  <button
                    className="card-main"
                    disabled={pending}
                    onClick={() =>
                      run(
                        { action: "approveOne", id: c.id },
                        "Pin aprobado.",
                      )
                    }
                  >
                    <Check size={18} /> Aprobar
                  </button>
                )}
                {c.status === "approved" && (
                  // Nothing left to do: the clock plans it with the rules.
                  <p className="card-wait">
                    ✓ Aprobado. La app lo programa sola cuando le toque (1 por
                    producto al día).
                  </p>
                )}
                {c.status === "queued" &&
                  (() => {
                    const job = data.queue.find(
                      (q) => q.creative_id === c.id && q.status === "pending",
                    );
                    return (
                      <p className="card-wait">
                        <CalendarDays size={16} /> En cola
                        {job
                          ? `: sale el ${new Date(job.scheduled_at).toLocaleString("es", whenOptions(data.settings.timezone))}`
                          : "."}
                      </p>
                    );
                  })()}
                <div className="card-tools">
                  {!["queued", "published"].includes(c.status) && (
                    <button className="secondary" onClick={() => edit(c)}>
                      <Pencil size={17} /> Editar
                    </button>
                  )}
                  {["draft", "approved"].includes(c.status) && (
                    <button
                      className="secondary danger"
                      disabled={pending}
                      onClick={() =>
                        run({ action: "reject", id: c.id }, "Pin rechazado")
                      }
                    >
                      <X size={17} /> Rechazar
                    </button>
                  )}
                  <span className="card-tools-end">
                    {["draft", "approved", "rejected"].includes(c.status) && (
                      <button
                        className="secondary danger icon-only"
                        disabled={pending}
                        aria-label="Eliminar este Pin"
                        title="Eliminar Pin"
                        onClick={() => {
                          if (window.confirm("¿Eliminar este Pin? No se puede deshacer."))
                            run({ action: "deleteCreative", id: c.id }, "Pin eliminado");
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                    <a
                      href={artworkSrc(c)}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir PNG para descargar"
                      className="button secondary icon-only"
                    >
                      <ArrowDownToLine size={18} />
                      <span className="sr-only">Descargar creatividad</span>
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty
        icon={WandSparkles}
        title="Aquí empiezan las buenas ideas"
        action={
          <Link className="button" href="/pin-studio">
            Ir a Pin Studio <ArrowRight size={16} />
          </Link>
        }
      >
        Genera conceptos a partir de tus productos o crea tu primer Pin
        manualmente.
      </Empty>
    );

  return (
    <FeedbackContext.Provider value={notice}>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "open" : ""}`}>
          <Link href="/" className="brand">
            <div className="brand-mark">
              a<span>↗</span>
            </div>
            <div>
              affiliate<span>COMMAND</span>
            </div>
          </Link>
          <Link href="/settings" className="workspace-switch">
            <span className="workspace-avatar">A</span>
            <span>
              Mi espacio de trabajo<small>Amazon + Pinterest</small>
            </span>
            <ChevronRight size={14} />
          </Link>
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Navegación principal">
            {navigation.map((item, i) => (
              <div key={item.id}>
                {i === 8 && (
                  <div className="nav-label nav-divider">INTELLIGENCE</div>
                )}
                {i === 10 && <div className="nav-divider" />}
                <Link
                  href={item.id === "dashboard" ? "/" : `/${item.id}`}
                  className={section === item.id ? "active" : ""}
                  onClick={() => setMobile(false)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.id === "approval-queue" && draftCount > 0 && (
                    <b>{draftCount}</b>
                  )}
                  {item.id === "ai-insights" && <span className="new-dot" />}
                </Link>
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="mode-card">
              <ShieldCheck size={18} />
              <div>
                {data.settings.mode === "assisted"
                  ? "AI Assisted"
                  : data.settings.mode === "manual"
                    ? "Manual"
                    : "Autopilot"}
                <small>
                  Tú apruebas cada Pin
                </small>
              </div>
              <span className="online-dot" />
            </div>
            <button
              className="profile"
              onClick={() =>
                data.email ? setModal("account") : setModal("login")
              }
            >
              <span className="avatar">
                {data.email?.slice(0, 1).toUpperCase() || "T"}
              </span>
              <span>
                {data.email?.split("@")[0] || "Tu workspace"}
                <small>
                  {data.email ? "Sesión activa" : "Configuración inicial"}
                </small>
              </span>
              <Settings2 size={16} />
            </button>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                aria-label="Abrir menú"
                className="icon-button mobile-menu"
                onClick={() => setMobile(!mobile)}
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{header.label}</strong>
            </div>
            <div className="top-actions">
              <span className="connection-pill">
                <i className={data.connected ? "online-dot" : "offline-dot"} />
                {data.connected
                  ? "Pinterest conectado"
                  : "Pinterest sin conectar"}
              </span>
              <Link
                href="/settings"
                className="icon-button"
                aria-label="Ayuda y configuración"
              >
                <CircleHelp size={19} />
              </Link>
              <span className="avatar small">
                {data.email?.slice(0, 1).toUpperCase() || "T"}
              </span>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <h1>{titles[section][0]}</h1>
                <p>{titles[section][1]}</p>
              </div>
              {["dashboard", "products", "discover"].includes(section) && (
                <button onClick={() => setModal("product")}>
                  <Plus size={17} /> Añadir producto
                </button>
              )}
            </div>
            {!ready && (
              <div className="setup-banner">
                <div>
                  <ShieldCheck size={18} />
                  <span>
                    {data.configured
                      ? "Tu espacio está listo. Inicia sesión para acceder a tus datos."
                      : "Vista inicial · Conecta Supabase para guardar tus productos y empezar."}
                  </span>
                </div>
                {data.configured ? (
                  <button
                    className="text-button"
                    onClick={() => setModal("login")}
                  >
                    Iniciar sesión <ArrowRight size={15} />
                  </button>
                ) : (
                  <Link href="/settings">
                    Ver configuración <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            )}
            {notice && (
              <div
                role={notice.error ? "alert" : "status"}
                className={`notice ${notice.error ? "error" : ""}`}
              >
                {notice.text}
                <button
                  className="icon-button"
                  aria-label="Cerrar notificación"
                  onClick={() => setNotice(null)}
                >
                  <X size={17} />
                </button>
              </div>
            )}
            {pending && (
              <div className="working" role="status">
                <LoaderCircle className="spin" size={15} /> Guardando cambios…
              </div>
            )}

            {section === "dashboard" && (
              <>
                {todayPanel}
                <section className="hero">
                  <div className="hero-copy">
                    <h2>
                      Descubre. Crea. <em>Conecta.</em>
                    </h2>
                    <p>
                      Convierte productos que te gustan en contenido que
                      inspira. La automatización te acompaña; tú decides qué
                      publicar.
                    </p>
                    <div className="hero-actions">
                      <Link className="button" href="/pin-studio">
                        Abrir Pin Studio <ArrowUpRight size={18} />
                      </Link>
                      <span className="hero-foot">
                        <ShieldCheck size={18} />{" "}
                        {data.settings.mode === "autopilot" &&
                        data.settings.autopilot_enabled
                          ? "Autopilot: crea y programa; tú apruebas cada Pin"
                          : "Revisión humana activada"}
                      </span>
                    </div>
                  </div>
                </section>
                <div className="metrics-grid">
                  <Stat
                    label="Productos en tu colección"
                    value={number(data.products.length)}
                    foot="Listos para convertirse en ideas"
                    icon={Package}
                  />
                  <Stat
                    label="Pins por revisar"
                    value={number(draftCount)}
                    foot="Tu próxima publicación empieza aquí"
                    icon={ListChecks}
                  />
                  <Stat
                    label="Impresiones"
                    value={number(metrics.impressions)}
                    foot="Pinterest · últimos 30 días"
                    icon={BarChart3}
                  />
                  <Stat
                    label="Clics salientes"
                    value={number(metrics.clicks)}
                    foot={
                      metrics.ctr === null
                        ? "El CTR aparecerá con tus datos"
                        : `${metrics.ctr.toFixed(2)}% CTR · últimos 30 días`
                    }
                    icon={ArrowUpRight}
                  />
                </div>
                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Tu flujo de trabajo</h2>
                        <p>Un paso a la vez. Todo bajo control.</p>
                      </div>
                      <span className="subtle-pill">
                        {data.settings.mode === "autopilot" &&
                        data.settings.autopilot_enabled
                          ? "AUTOPILOT"
                          : "SEMIAUTOMÁTICO"}
                      </span>
                    </div>
                    <div className="workflow">
                      {[
                        {
                          n: "01",
                          t: "Seleccionar",
                          v: data.products.length,
                          href: "/products",
                        },
                        {
                          n: "02",
                          t: "Crear",
                          v: data.creatives.length,
                          href: "/pin-studio",
                        },
                        {
                          n: "03",
                          t: "Revisar",
                          v: draftCount,
                          href: "/approval-queue",
                        },
                        {
                          n: "04",
                          t: "Programar",
                          v: data.queue.filter((q) => q.status === "pending")
                            .length,
                          href: "/scheduler",
                        },
                        {
                          n: "05",
                          t: "Medir",
                          v: data.publications.length,
                          href: "/analytics",
                        },
                      ].map((x) => (
                        <Link href={x.href} key={x.n}>
                          <span>{x.n}</span>
                          <b>{x.v}</b>
                          <small>{x.t}</small>
                        </Link>
                      ))}
                    </div>
                    <div className="panel-divider" />
                    <div className="panel-heading compact">
                      <h3>La siguiente idea es tuya</h3>
                      <Link href="/products">
                        Ver productos <ArrowRight size={14} />
                      </Link>
                    </div>
                    {data.products.length ? (
                      <div className="product-mini-list">
                        {data.products.slice(0, 3).map((p) => (
                          <Link href="/pin-studio" key={p.id}>
                            <span className="product-icon">
                              <Package size={20} />
                            </span>
                            <div>
                              <strong>{p.title}</strong>
                              <small>
                                {p.category || "Sin categoría"} · {p.asin}
                              </small>
                            </div>
                            <ArrowUpRight size={17} />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="start-row">
                        <span className="product-icon">
                          <Package size={26} />
                        </span>
                        <div>
                          <h3>Añade tu primer descubrimiento</h3>
                          <p>Solo necesitas una URL de Amazon o un ASIN.</p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => setModal("product")}
                        >
                          <Plus size={15} /> Añadir
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="panel launch-panel">
                    <div className="panel-heading">
                      <h2>Listo para despegar</h2>
                      <span className="progress-label">
                        {
                          [
                            ready,
                            !!data.settings.tracking_id,
                            data.connected,
                            data.products.length > 0,
                          ].filter(Boolean).length
                        }
                        /4
                      </span>
                    </div>
                    <p>
                      Prepara tu espacio una vez.
                      <br />
                      Dale continuidad a tus ideas.
                    </p>
                    {[
                      {
                        label: "Configurar tu workspace",
                        done: ready,
                        href: "/settings",
                      },
                      {
                        label: "Añadir tracking de Amazon",
                        done: !!data.settings.tracking_id,
                        href: "/settings",
                      },
                      {
                        label: "Conectar Pinterest Business",
                        done: data.connected,
                        href: "/settings",
                      },
                      {
                        label: "Elegir tu primer producto",
                        done: data.products.length > 0,
                        href: "/products",
                      },
                    ].map((x, i) => (
                      <Link
                        className="checklist-item"
                        href={x.href}
                        key={x.label}
                      >
                        <span className={x.done ? "done" : ""}>
                          {x.done ? <Check size={13} /> : i + 1}
                        </span>
                        {x.label}
                        <ChevronRight size={14} />
                      </Link>
                    ))}
                    <div className="tip">
                      <Sparkles size={18} />
                      <p>
                        <b>Empieza pequeño.</b> Prueba tres conceptos de un
                        producto y publica el que mejor encaje con tu audiencia.
                      </p>
                    </div>
                  </section>
                </div>
                <section className="panel activity">
                  <div className="panel-heading">
                    <h2>Actividad reciente</h2>
                    <span className="muted">Registro de tu workspace</span>
                  </div>
                  {data.audit.length ? (
                    data.audit.slice(0, 5).map((a) => (
                      <div className="activity-row" key={a.id}>
                        <span className="online-dot" />
                        <strong>{a.action}</strong>
                        <time>
                          {new Date(a.created_at).toLocaleString("es", whenOptions(data.settings.timezone))}
                        </time>
                      </div>
                    ))
                  ) : (
                    <p className="activity-empty">
                      Tus productos, revisiones y publicaciones aparecerán aquí.
                    </p>
                  )}
                </section>
              </>
            )}

            {section === "products" && (
              <section className="panel">
                <div className="toolbar">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="Buscar productos"
                      placeholder="Buscar por nombre, ASIN o categoría…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <span className="muted">
                    {data.products.length} productos
                    {data.clicks.total > 0 &&
                      ` · ${data.clicks.total} clics a la tienda en 30 días (${Object.entries(data.clicks.bySource)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => `${k} ${v}`)
                        .join(", ")})`}
                    {(() => {
                      // Every product gets at least one video for TikTok and Instagram.
                      const missing = data.products.filter((p) => !p.video_path).length;
                      return missing ? <b className="no-video-count"> · {missing} sin video</b> : " · todos con video";
                    })()}
                  </span>
                </div>
                {data.products.length ? (
                  <div className="table-wrap">
                    <table className="stack-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Marketplace</th>
                          <th>Categoría</th>
                          <th className="num">Pins</th>
                          <th className="actions-head">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.products
                          .filter((p) =>
                            `${p.title} ${p.asin} ${p.category}`
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td className="wrap">
                                <div className="table-product">
                                  {p.images?.length ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <button
                                      className="thumb-button"
                                      title="Ver foto en grande"
                                      onClick={() => setModal(`view:${p.id}`)}
                                    >
                                      <img
                                        className="table-thumb"
                                        src={`/api/product-image?path=${encodeURIComponent(p.images[0])}`}
                                        alt={`Fotos de ${p.title}`}
                                      />
                                    </button>
                                  ) : (
                                    <span className="product-icon">
                                      <Package size={21} />
                                    </span>
                                  )}
                                  <div>
                                    <b>{p.title}</b>
                                    <small>
                                      {p.asin}
                                      {data.clicks.byProduct[p.id]
                                        ? ` · ${data.clicks.byProduct[p.id]} clics a la tienda (30 días)`
                                        : ""}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td className="meta">{p.marketplace.replace("www.", "")}</td>
                              <td className="wrap meta">{p.category || "Sin categoría"}</td>
                              <td className="num" data-label="Pins">
                                {
                                  data.creatives.filter(
                                    (c) => c.product_id === p.id,
                                  ).length
                                }
                              </td>
                              <td>
                                <div className="row-actions">
                                {(() => {
                                  const made = data.creatives.filter((c) => c.product_id === p.id).length;
                                  // Once a product has Pins, the next step is reviewing them.
                                  return made ? (
                                    <Link
                                      className="button secondary done-pins pins-slot"
                                      href="/approval-queue"
                                      title="Ver y revisar los Pins de este producto"
                                    >
                                      <Check size={17} /> {made} Pins creados
                                    </Link>
                                  ) : (
                                    <button
                                      className="pins-slot"
                                      disabled={pending}
                                      onClick={() =>
                                        run(
                                          {
                                            action: "generate",
                                            product_id: p.id,
                                            ai: data.settings.mode !== "manual",
                                          },
                                          "Tres Pins creados. Revísalos en Approval Queue.",
                                        )
                                      }
                                    >
                                      <Sparkles size={17} /> Crear Pins
                                    </button>
                                  );
                                })()}
                                <button
                                  className="secondary"
                                  title="Elegir fotos de tu biblioteca"
                                  disabled={pending}
                                  onClick={() => setModal(`photos:${p.id}`)}
                                >
                                  <Camera size={17} /> Fotos ({p.images?.length || 0})
                                </button>
                                <label
                                  className={`button secondary video-slot${pending ? " disabled" : ""}${p.video_path ? "" : " no-video"}`}
                                  title={
                                    p.video_path
                                      ? "Cambiar el video del producto (MP4 o MOV)"
                                      : "Este producto todavía no tiene video para TikTok e Instagram"
                                  }
                                >
                                  <Film size={17} /> {p.video_path ? "Video ✓" : "Sin video"}
                                  <input
                                    type="file"
                                    accept="video/mp4,video/quicktime"
                                    hidden
                                    disabled={pending}
                                    onChange={(e) => {
                                      const file = e.currentTarget.files?.[0];
                                      e.currentTarget.value = "";
                                      if (file) uploadVideo(p.id, file);
                                    }}
                                  />
                                </label>
                                {(() => {
                                  const reel = data.reels.find((r) => r.product_id === p.id);
                                  if (reel?.status === "published")
                                    return (
                                      <a
                                        className="button secondary reel-slot"
                                        href={reel.permalink || "https://www.instagram.com/"}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Ver el Reel en Instagram"
                                      >
                                        <Check size={17} /> Reel
                                      </a>
                                    );
                                  if (reel)
                                    return (
                                      <span
                                        className="button secondary disabled reel-slot"
                                        title={reel.error || "Instagram está procesando el video"}
                                      >
                                        {reel.status === "failed"
                                          ? "Reel con error"
                                          : Date.parse(reel.scheduled_at) > Date.now() + 60e3
                                            ? `Reel ${new Date(reel.scheduled_at).toLocaleDateString("es", { day: "numeric", month: "short" })}`
                                            : "Reel en cola"}
                                      </span>
                                    );
                                  // An invisible slot keeps every row's buttons in line.
                                  if (!p.video_path || !data.instagram)
                                    return (
                                      <span className="button secondary reel-slot" style={{ visibility: "hidden" }} aria-hidden="true">
                                        Reel
                                      </span>
                                    );
                                  return (
                                    <button
                                      className="secondary reel-slot"
                                      disabled={pending}
                                      title="Publicar el video de este producto como Reel en Instagram"
                                      onClick={() =>
                                        run(
                                          { action: "queueReel", product_id: p.id },
                                          "Reel en cola. Sale en Instagram en los próximos 15 a 30 minutos.",
                                        )
                                      }
                                    >
                                      <Film size={17} /> Publicar Reel
                                    </button>
                                  );
                                })()}
                                {/* Always rendered so every row keeps the same layout. */}
                                  <button
                                    className="secondary danger icon-only"
                                    aria-label="Quitar todas las fotos"
                                    title="Quitar todas las fotos"
                                    style={p.images?.length ? undefined : { visibility: "hidden" }}
                                    disabled={pending || !p.images?.length}
                                    onClick={() => {
                                      if (window.confirm("¿Quitar todas las fotos de este producto?"))
                                        run(
                                          { action: "clearProductImages", product_id: p.id },
                                          "Fotos eliminadas",
                                        );
                                    }}
                                  >
                                    <ImageOff size={18} />
                                  </button>
                                <a
                                  className="button secondary icon-only"
                                  aria-label={`Abrir ${p.title} en Amazon`}
                                  title="Ver en Amazon"
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink size={17} />
                                </a>
                                <button
                                  className="secondary danger icon-only"
                                  disabled={pending}
                                  aria-label={`Eliminar ${p.title}`}
                                  title="Eliminar producto"
                                  onClick={() => {
                                    const n = data.creatives.filter((c) => c.product_id === p.id).length;
                                    if (
                                      window.confirm(
                                        `¿Eliminar "${p.title}"?` +
                                          (n ? ` También se borrarán sus ${n} Pins de la app (los que ya están en Pinterest se quedan allá).` : "") +
                                          " No se puede deshacer.",
                                      )
                                    )
                                      run({ action: "deleteProduct", product_id: p.id }, "Producto eliminado");
                                  }}
                                >
                                  <Trash2 size={18} />
                                </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Una colección con tu sello"
                    action={
                      <button onClick={() => setModal("product")}>
                        <Plus size={16} /> Añadir mi primer producto
                      </button>
                    }
                  >
                    Guarda el enlace y los datos que hayas verificado. No
                    necesitas acceso a Creators API.
                  </Empty>
                )}
              </section>
            )}

            {section === "fotos" && (
              <MediaLibrary data={data} run={run} pending={pending} uploadVideo={uploadVideo} />
            )}

            {section === "discover" && (
              <div className="two-col">
                <section className="panel discover-card">
                  <span className="empty-icon">
                    <Compass size={28} />
                  </span>
                  <h2>
                    Lo que recomiendas
                    <br />
                    empieza contigo.
                  </h2>
                  <p>
                    Añade productos que conozcas y agrúpalos por categoría.
                    Revisa sus características en Amazon antes de crear
                    contenido.
                  </p>
                  <button onClick={() => setModal("product")}>
                    <Plus size={16} /> Importar URL o ASIN
                  </button>
                  {data.settings.storefront_url && (
                    <a
                      className="external-line"
                      href={data.settings.storefront_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir mi Storefront <ExternalLink size={15} />
                    </a>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Amazon Creators API</h2>
                    <span className="subtle-pill">PREPARADO</span>
                  </div>
                  <p className="body-copy">
                    La aplicación funciona con tu selección manual. El adaptador
                    para consultar el catálogo se puede completar cuando
                    dispongas de acceso aprobado y del contrato de API
                    correspondiente.
                  </p>
                  <div className="integration-placeholder">
                    <Package size={42} />
                    <h3>Sin catálogo automático conectado</h3>
                    <p>
                      No se muestran tendencias, precios ni rankings inventados.
                    </p>
                  </div>
                  <Link href="/settings" className="button secondary">
                    Ver conexiones <ArrowRight size={15} />
                  </Link>
                </section>
              </div>
            )}

            {section === "pin-studio" && (
              <>
                <StudioTools
                  data={data}
                  run={run}
                  pending={pending}
                  openManual={() => setModal("manual")}
                />
                <div className="section-heading">
                  <h2>
                    Tus conceptos <span>{data.creatives.length}</span>
                  </h2>
                  <span className="muted">
                    Vertical 1000 × 1500 · Editable · PNG
                  </span>
                </div>
                {cards(data.creatives.filter((c) => c.status !== "published"))}
              </>
            )}
            {section === "approval-queue" && (
              <>
                <div className="info-strip">
                  <ShieldCheck size={20} />
                  <p>
                    Revisa título, descripción, board y disclosure. Si editas un
                    Pin aprobado, volverá a necesitar revisión.
                  </p>
                </div>
                {draftCount > 0 && (
                  <div className="approve-all">
                    <div>
                      <b>
                        {draftCount} {draftCount === 1 ? "Pin listo" : "Pins listos"} para revisar
                      </b>
                      <small>
                        Mira cada Pin y toca Aprobar en los que quieras
                        publicar (Pinterest pide que elijas cada uno). Después
                        se publican solos: 1 por producto al día,
                        máximo {data.settings.daily_limit} al día, entre 9 am y
                        9 pm (Nueva York), sin repetir producto en el mismo board
                        antes de 7 días.
                      </small>
                    </div>
                  </div>
                )}
                {cards(
                  data.creatives.filter((c) =>
                    ["draft", "approved", "rejected"].includes(c.status),
                  ),
                )}
              </>
            )}
            {section === "scheduler" && (
              <>
                {todayPanel}
                <div className="info-strip">
                  <CalendarDays size={20} />
                  <p>
                    Horas mostradas en <b>{data.settings.timezone}</b>. Máximo{" "}
                    {data.settings.daily_limit} Pins por día (Nueva York), separados
                    al menos {data.settings.min_interval_minutes} minutos. El
                    Autopilot planea 24 horas y da prioridad a productos nuevos.
                  </p>
                  <button
                    className="secondary"
                    disabled={pending}
                    onClick={() => run({ action: "publishDue" })}
                  >
                    Procesar siguiente
                  </button>
                </div>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Cola de publicación</h2>
                    <span className="subtle-pill">RELOJ · CADA 15 MIN</span>
                  </div>
                  {data.queue.length ? (() => {
                    // Next Pins first (soonest at the top), then the published
                    // ones; cancelled rows are history, folded away.
                    const live = ["pending", "processing", "uncertain", "failed"];
                    const upcoming = data.queue
                      .filter((q) => live.includes(q.status))
                      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
                    const done = data.queue.filter(
                      (q) => !live.includes(q.status) && q.status !== "cancelled",
                    );
                    const cancelled = data.queue.filter((q) => q.status === "cancelled");
                    const row = (q: (typeof data.queue)[number]) => (
                        <div className="queue-row" key={q.id}>
                          <div className="date-tile">
                            <CalendarDays size={19} />
                            <span>
                              {new Date(q.scheduled_at).toLocaleDateString(
                                "es",
                                {
                                  day: "numeric",
                                  month: "short",
                                  timeZone: data.settings.timezone,
                                },
                              )}
                            </span>
                          </div>
                          <div className="queue-detail">
                            <h3>
                              {data.creatives.find(
                                (c) => c.id === q.creative_id,
                              )?.title || "Pin"}
                            </h3>
                            <p>
                              {new Date(q.scheduled_at).toLocaleString("es", whenOptions(data.settings.timezone))}{" "}
                              · {q.attempts} intentos
                            </p>
                            {q.error && <p className="danger">{q.error}</p>}
                          </div>
                          <Badge status={q.status} />
                          {["pending", "failed"].includes(q.status) && (
                            <button
                              className="secondary"
                              disabled={pending}
                              onClick={() =>
                                run(
                                  { action: "cancel", id: q.id },
                                  "Programación cancelada. El Pin vuelve a revisión.",
                                )
                              }
                            >
                              Cancelar
                            </button>
                          )}
                          {q.status === "uncertain" && (
                            <button
                              className="secondary"
                              onClick={() => setModal(`reconcile:${q.id}`)}
                            >
                              Reconciliar
                            </button>
                          )}
                        </div>
                    );
                    return (
                      <div className="queue-list">
                        {upcoming.map(row)}
                        {done.map(row)}
                        {cancelled.length > 0 && (
                          <details className="queue-cancelled">
                            <summary>Ver cancelados ({cancelled.length})</summary>
                            {cancelled.map(row)}
                          </details>
                        )}
                      </div>
                    );
                  })() : (
                    <Empty
                      icon={CalendarDays}
                      title="Un calendario con espacio para tus ideas"
                      action={
                        <Link href="/approval-queue" className="button">
                          Revisar Pins <ArrowRight size={15} />
                        </Link>
                      }
                    >
                      Aprueba un Pin y elige cuándo compartirlo.
                    </Empty>
                  )}
                </section>
                <div className="section-heading">
                  <h2>Aprobados, listos para programar</h2>
                </div>
                {cards(data.creatives.filter((c) => c.status === "approved"))}
              </>
            )}
            {section === "published" && (
              <section className="panel">
                {data.publications.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Pin</th>
                          <th>Board</th>
                          <th>Publicado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.publications.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <b>
                                {
                                  data.creatives.find(
                                    (c) => c.id === p.creative_id,
                                  )?.title
                                }
                              </b>
                              <small>{p.template}</small>
                            </td>
                            <td>
                              {
                                data.boards.find((b) => b.id === p.board_id)
                                  ?.name
                              }
                            </td>
                            <td>
                              {new Date(p.published_at).toLocaleString("es", whenOptions(data.settings.timezone))}
                            </td>
                            <td>
                              <a
                                href={`https://www.pinterest.com/pin/${p.pinterest_id}/`}
                                target="_blank"
                                rel="noreferrer"
                                className="button secondary"
                              >
                                Ver Pin <ExternalLink size={15} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    icon={Send}
                    title="Tu primera publicación está por venir"
                  >
                    Aquí solo aparecerán Pins confirmados por Pinterest.
                  </Empty>
                )}
              </section>
            )}
            {section === "analytics" && (
              <Analytics data={data} run={run} pending={pending} />
            )}
            {section === "ai-insights" && (
              <>
                <section className="insight-banner">
                  <Sparkles size={28} />
                  <div>
                    <h2>Observa. Experimenta. Aprende.</h2>
                    <p>
                      Este análisis usa reglas transparentes sobre datos reales;
                      no predice ventas ni inventa rendimiento.
                    </p>
                  </div>
                </section>
                <div className="insights-list">
                  {insights(
                    data.publications,
                    data.metrics.filter(
                      (m) =>
                        m.date >=
                        new Date(Date.now() - 30 * 86400000)
                          .toISOString()
                          .slice(0, 10),
                    ),
                    data.settings.timezone,
                  ).map((text, i) => (
                    <article className="panel insight" key={text}>
                      <span>0{i + 1}</span>
                      <div>
                        <h3>
                          {i === 0
                            ? "Tu punto de partida"
                            : "El siguiente experimento"}
                        </h3>
                        <p>{text}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <Link href="/analytics" className="button secondary">
                  Explorar los datos <ArrowRight size={16} />
                </Link>
              </>
            )}
            {section === "settings" && (
              <SettingsPanel
                data={data}
                pending={pending}
                run={run}
                connect={async () => {
                  setPending(true);
                  try {
                    const r = await fetch("/api/pinterest/connect", {
                        method: "POST",
                      }),
                      j = await r.json();
                    if (!r.ok) throw new Error(j.error);
                    window.location.assign(j.url);
                  } catch (e) {
                    setNotice({
                      text:
                        e instanceof Error ? e.message : "No se pudo conectar.",
                      error: true,
                    });
                  } finally {
                    setPending(false);
                  }
                }}
                login={() => setModal("login")}
                connectInstagram={async () => {
                  setPending(true);
                  try {
                    const r = await fetch("/api/instagram/connect", { method: "POST" }),
                      j = await r.json();
                    if (!r.ok) throw new Error(j.error);
                    window.location.assign(j.url);
                  } catch (e) {
                    setNotice({
                      text: e instanceof Error ? e.message : "No se pudo conectar Instagram.",
                      error: true,
                    });
                  } finally {
                    setPending(false);
                  }
                }}
              />
            )}
            <footer>
              <span>
                Amazon Affiliate Command <b>·</b> Construye con intención.
              </span>
              <span>
                <ShieldCheck size={13} /> Tus cuentas. Tu criterio. Tu control.
              </span>
            </footer>
          </main>
        </div>
        {modal?.startsWith("view:") &&
          (() => {
            const prod = data.products.find((x) => x.id === modal.slice(5));
            return prod?.images?.length ? (
              <Modal title={prod.title} close={() => setModal(null)}>
                <ProductGallery images={prod.images} title={prod.title} />
              </Modal>
            ) : null;
          })()}
        {modal?.startsWith("photos:") &&
          (() => {
            const prod = data.products.find((x) => x.id === modal.slice(7));
            return prod ? (
              <Modal title={`Fotos de ${prod.title}`} close={() => setModal(null)}>
                <ProductPhotos
                  product={prod}
                  library={data.photos}
                  pending={pending}
                  run={run}
                  done={() => setModal(null)}
                />
              </Modal>
            ) : null;
          })()}
        {modal === "product" && (
          <Modal title="Añadir un producto" close={() => setModal(null)}>
            <ProductForm
              settings={data.settings}
              library={data.photos}
              products={data.products}
              pending={pending}
              submit={async (body) => {
                if (await run(body, "Producto guardado en tu colección"))
                  setModal(null);
              }}
            />
          </Modal>
        )}
        {(modal === "edit" || modal === "manual") && (
          <Modal
            title={
              editing && modal === "edit"
                ? "Editar concepto"
                : "Crear un Pin manual"
            }
            close={() => {
              setModal(null);
              setEditing(null);
            }}
          >
            <CreativeForm
              key={editing?.id || "new"}
              creative={modal === "edit" ? editing : null}
              data={data}
              pending={pending}
              submit={async (body) => {
                if (
                  await run(
                    body,
                    "Concepto guardado. Revisa la nueva versión antes de aprobar.",
                  )
                ) {
                  setModal(null);
                  setEditing(null);
                }
              }}
            />
          </Modal>
        )}
        {modal === "schedule" && scheduling && (
          <Modal title="Programar Pin" close={() => setModal(null)}>
            <ScheduleForm
              timezone={data.settings.timezone}
              pending={pending}
              submit={async (when) => {
                if (
                  await run(
                    { action: "schedule", id: scheduling.id, when },
                    "Pin programado",
                  )
                )
                  setModal(null);
              }}
            />
          </Modal>
        )}
        {modal === "login" && (
          <Modal title="Accede a tu workspace" close={() => setModal(null)}>
            {data.configured ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  auth(
                    "login",
                    String(f.get("email")),
                    String(f.get("password")),
                  );
                }}
              >
                <p className="body-copy">
                  Usa el usuario creado en Supabase Auth para este proyecto.
                </p>
                <Field label="Email">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                  />
                </Field>
                <Field label="Contraseña">
                  <input
                    type="password"
                    name="password"
                    minLength={8}
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <button className="full" disabled={pending}>
                  Iniciar sesión <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <div className="body-copy">
                <p>
                  Primero configura Supabase en el servidor siguiendo el README
                  incluido en el proyecto.
                </p>
                <p>
                  Necesitas la URL del proyecto, la clave pública y la clave de
                  servicio. Los secretos se guardan en variables del servidor.
                </p>
                <Link
                  className="button"
                  href="/settings"
                  onClick={() => setModal(null)}
                >
                  Ver pasos de configuración
                </Link>
              </div>
            )}
          </Modal>
        )}
        {modal === "account" && (
          <Modal title="Tu cuenta" close={() => setModal(null)}>
            <p className="body-copy">{data.email}</p>
            <button
              className="secondary"
              disabled={pending}
              onClick={() => auth("logout")}
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </Modal>
        )}
        {modal?.startsWith("reconcile:") && (
          <Modal title="Reconciliar publicación" close={() => setModal(null)}>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await run(
                    {
                      action: "reconcile",
                      id: modal.split(":")[1],
                      pin_id: String(f.get("pin_id")),
                    },
                    "Publicación reconciliada",
                  )
                )
                  setModal(null);
              }}
            >
              <p className="body-copy">
                Busca el Pin en Pinterest. Introduce su ID; verificaremos que
                coincidan el board, el título y el producto. Un resultado
                incierto no se reintenta automáticamente.
              </p>
              <Field label="ID del Pin publicado">
                <input name="pin_id" pattern="[0-9]+" required />
              </Field>
              <button disabled={pending}>Verificar y registrar</button>
            </form>
          </Modal>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}

function Stat({
  label,
  value,
  foot,
  icon: Icon,
}: {
  label: string;
  value: string;
  foot: string;
  icon: typeof Package;
}) {
  return (
    <article className="stat">
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </article>
  );
}
// Shrinks photos in the browser before upload (max 1400 px, JPEG).
async function resizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new window.Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("No se pudo leer la foto."));
      i.src = url;
    });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function readPhotos(files: FileList | null, max: number) {
  const list = Array.from(files || [])
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, max);
  return Promise.all(list.map(resizePhoto));
}
// "" is a photo without category; null in a filter means all photos.
function CategoryChips({
  photos,
  value,
  onChange,
}: {
  photos: Photo[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const counts = new Map<string, number>();
  photos.forEach((p) => counts.set(p.category || "", (counts.get(p.category || "") || 0) + 1));
  const named = [...counts.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
  const chips: [string | null, string, number][] = [
    [null, "Todas", photos.length],
    ...named.map((c): [string, string, number] => [c, c, counts.get(c) || 0]),
    ...(counts.get("") ? [["", "Sin categoría", counts.get("") || 0] as [string, string, number]] : []),
  ];
  return (
    <div className="chip-row" role="group" aria-label="Filtrar por categoría">
      {chips.map(([key, label, n]) => (
        <button
          type="button"
          key={key ?? "all"}
          className={`chip ${value === key ? "on" : ""}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {label} <span>{n}</span>
        </button>
      ))}
    </div>
  );
}
// "Fotos" holds two libraries kept apart: photos and videos.
function MediaLibrary({
  data,
  run,
  pending,
  uploadVideo,
}: {
  data: Snapshot;
  run: Run;
  pending: boolean;
  uploadVideo: Upload;
}) {
  const [tab, setTab] = useState<"fotos" | "videos">("fotos");
  useEffect(() => {
    if (window.location.hash === "#videos") setTab("videos");
  }, []);
  const pick = (t: "fotos" | "videos") => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };
  return (
    <>
      <div className="media-tabs" role="tablist" aria-label="Biblioteca">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "fotos"}
          className={tab === "fotos" ? "on" : ""}
          onClick={() => pick("fotos")}
        >
          <Images size={18} /> Fotos <span>{data.photos.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "videos"}
          className={tab === "videos" ? "on" : ""}
          onClick={() => pick("videos")}
        >
          <Film size={18} /> Videos <span>{data.videos.length}</span>
        </button>
      </div>
      {tab === "fotos" ? (
        <PhotoLibrary photos={data.photos} run={run} pending={pending} />
      ) : (
        <VideoLibrary data={data} run={run} pending={pending} uploadVideo={uploadVideo} />
      )}
    </>
  );
}
function VideoLibrary({
  data,
  run,
  pending,
  uploadVideo,
}: {
  data: Snapshot;
  run: Run;
  pending: boolean;
  uploadVideo: Upload;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = async (list: File[]) => {
    const files = list.filter((f) => /^video\/(mp4|quicktime)$/.test(f.type));
    if (!files.length || busy) return;
    setBusy(true);
    try {
      for (const f of files) if (!(await uploadVideo(null, f))) break;
    } finally {
      setBusy(false);
    }
  };
  const choose = (
    <button disabled={pending || busy} onClick={() => input.current?.click()}>
      <Film size={18} /> {busy ? "Subiendo videos…" : "Subir videos"}
    </button>
  );
  return (
    <section
      className={`panel photo-drop ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        add(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="toolbar">
        <p className="video-note">
          Videos MP4 o MOV de hasta 100 MB. Elige el producto de cada video: sale como Reel
          en Instagram cuando sale su primer Pin.
        </p>
        {choose}
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            add(files);
          }}
        />
      </div>
      {data.videos.length ? (
        <div className="photo-grid video-grid">
          {data.videos.map((v) => {
            const reel = v.product_id ? data.reels.find((r) => r.product_id === v.product_id) : undefined;
            return (
              <figure key={v.id} className="photo-tile video-tile">
                {v.url ? (
                  // "#t=1.5" shows a frame past the opening fade instead of black.
                  <video src={`${v.url}#t=1.5`} controls preload="metadata" playsInline />
                ) : (
                  <div className="video-missing">Sin vista previa</div>
                )}
                <label className="tile-product">
                  <span>Producto</span>
                  <select
                    value={v.product_id || ""}
                    disabled={pending}
                    onChange={(e) =>
                      run(
                        { action: "assignVideo", id: v.id, product_id: e.target.value || null },
                        e.target.value
                          ? "Video asignado. Sale como Reel cuando salga el primer Pin del producto."
                          : "Video sin producto",
                      )
                    }
                  >
                    <option value="">Sin producto</option>
                    {data.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title.length > 60 ? `${p.title.slice(0, 58)}…` : p.title}
                      </option>
                    ))}
                  </select>
                </label>
                {reel && (
                  <span className={`reel-state ${reel.status}`} title={reel.error || undefined}>
                    {reel.status === "published"
                      ? "Reel publicado"
                      : reel.status === "failed"
                        ? "Reel con error"
                        : Date.parse(reel.scheduled_at) > Date.now() + 60e3
                          ? `Reel programado: ${new Date(reel.scheduled_at).toLocaleString("es", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}`
                          : "Reel en cola"}
                  </span>
                )}
                {!reel && v.product_id && data.instagram && (
                  <form
                    className="reel-schedule"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const when = new FormData(e.currentTarget).get("when") as string;
                      run(
                        {
                          action: "queueReel",
                          product_id: v.product_id,
                          ...(when ? { at: new Date(when).toISOString() } : {}),
                        },
                        when ? "Reel programado en Instagram." : "Reel en cola. Sale en Instagram en 15 a 30 minutos.",
                      );
                    }}
                  >
                    <label>
                      <span>Reel en Instagram</span>
                      <input type="datetime-local" name="when" aria-label="Fecha y hora del Reel (vacío = ahora)" />
                    </label>
                    <button className="secondary" disabled={pending}>
                      Programar
                    </button>
                  </form>
                )}
                <figcaption>
                  <span title={v.name}>{v.name}</span>
                  <button
                    className="icon-button danger"
                    aria-label={`Borrar ${v.name}`}
                    disabled={pending}
                    onClick={() => {
                      if (
                        confirm(
                          "¿Borrar este video? Se quita también de su producto. Los Reels ya publicados se quedan en Instagram.",
                        )
                      )
                        run({ action: "deleteVideo", id: v.id }, "Video borrado");
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <Empty icon={Film} title="Todavía no hay videos" action={choose}>
          Sube aquí los videos de tus productos, incluidos los que te preparemos.
          Luego eliges el producto de cada uno, sin mezclarlos con las fotos.
        </Empty>
      )}
    </section>
  );
}
function PhotoLibrary({
  photos,
  run,
  pending,
}: {
  photos: Photo[];
  run: Run;
  pending: boolean;
}) {
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const listId = useId();
  const names = [...new Set(photos.map((p) => p.category).filter(Boolean))].sort();
  const shown =
    filter === null ? photos : photos.filter((p) => (p.category || "") === filter);
  const upload = async (list: File[]) => {
    const files = list.filter((f) => f.type.startsWith("image/"));
    if (!files.length || busy.current) return;
    busy.current = true;
    setReading(true);
    try {
      // Five per request keeps each upload under the server limit.
      for (let i = 0; i < files.length; i += 5) {
        const batch = files.slice(i, i + 5);
        const items = await Promise.all(
          batch.map(async (f, n) => ({
            data: await resizePhoto(f),
            // Pasted screenshots all arrive as "image.png".
            name: (f.name && f.name !== "image.png"
              ? f.name
              : `foto-pegada-${new Date().toISOString().slice(0, 10)}-${i + n + 1}.jpg`
            ).slice(0, 120),
          })),
        );
        const saved = Math.min(i + 5, files.length);
        if (
          !(await run(
            { action: "addPhotos", photos: items, category: category.trim() },
            files.length === 1
              ? "Foto guardada en tu biblioteca"
              : `${saved} de ${files.length} fotos guardadas`,
          ))
        )
          break;
      }
    } finally {
      busy.current = false;
      setReading(false);
    }
  };
  // Ctrl+V anywhere on the page adds the copied photos.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable='true']")) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (!files.some((f) => f.type.startsWith("image/"))) return;
      e.preventDefault();
      upload(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });
  return (
    <section
      className={`panel photo-drop ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="toolbar">
        <label className="inline-field">
          <span>Categoría para fotos nuevas</span>
          <Combo
            list={listId}
            value={category}
            maxLength={60}
            placeholder="Ej: Colágeno"
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button
          disabled={pending || reading}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={18} />
          {reading ? "Guardando fotos…" : "Subir fotos"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = "";
            upload(files);
          }}
        />
      </div>
      <div className="paste-hint">
        <ClipboardPaste size={22} />
        <p>
          <b>Copia tus fotos y pégalas aquí con Ctrl+V.</b> En la carpeta: Ctrl+A
          para seleccionar todas, Ctrl+C para copiar. También puedes
          arrastrarlas a esta página. Se guardan en la categoría de arriba.
        </p>
      </div>
      {photos.length > 0 && (
        <CategoryChips
          photos={photos}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            if (v) setCategory(v);
          }}
        />
      )}
      {photos.length ? (
        <div className="photo-grid">
          {shown.map((p) => (
            <figure key={p.id} className="photo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/product-image?path=${encodeURIComponent(p.path)}`}
                alt={p.name || "Foto de la biblioteca"}
                loading="lazy"
              />
              <input
                key={p.category || ""}
                className="tile-category"
                list={listId}
                defaultValue={p.category || ""}
                maxLength={60}
                placeholder="Sin categoría"
                aria-label={`Categoría de ${p.name || "la foto"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (p.category || ""))
                    run(
                      { action: "setPhotoCategory", ids: [p.id], category: v },
                      v ? `Foto movida a ${v}` : "Foto sin categoría",
                    );
                }}
              />
              <figcaption>
                <span title={p.name}>{p.name || "Sin nombre"}</span>
                <button
                  className="icon-button danger"
                  aria-label={`Borrar ${p.name || "foto"}`}
                  disabled={pending}
                  onClick={() => {
                    if (
                      confirm(
                        "¿Borrar esta foto de la biblioteca? Los productos que ya la usan la conservan.",
                      )
                    )
                      run({ action: "deletePhoto", id: p.id }, "Foto borrada");
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <Empty
          icon={Images}
          title="Tu biblioteca está vacía"
          action={
            <button onClick={() => input.current?.click()}>
              <ImagePlus size={18} /> Subir fotos
            </button>
          }
        >
          Sube aquí las fotos de tus productos, incluidas las que te preparemos.
          Luego las eliges al añadir un producto, sin volver a subirlas.
        </Empty>
      )}
    </section>
  );
}
// Text input with a visible arrow that opens its remembered values.
function Combo(props: React.InputHTMLAttributes<HTMLInputElement> & { list: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="combo">
      <input ref={ref} autoComplete="off" {...props} />
      <button
        type="button"
        className="combo-arrow"
        aria-label="Ver opciones guardadas"
        tabIndex={-1}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          el.focus();
          try {
            el.showPicker();
          } catch {
            /* Older browsers: focusing still lists the options as you type. */
          }
        }}
      >
        <ChevronDown size={20} />
      </button>
    </span>
  );
}
// Short stable key for cache-busting URLs.
function shortHash(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
// Distinct non-empty values, most recent first.
// Dates and times read the same everywhere: "lun 20 oct, 9:15 a. m.".
function whenOptions(timeZone: string): Intl.DateTimeFormatOptions {
  return {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  };
}
function remembered(values: (string | undefined)[]) {
  return [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))];
}
function LibraryPicker({
  library,
  picked,
  setPicked,
  room,
  used,
}: {
  library: Photo[];
  picked: string[];
  setPicked: (ids: string[]) => void;
  room: number;
  used: number;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const shown =
    filter === null ? library : library.filter((p) => (p.category || "") === filter);
  return (
    <fieldset className="photo-picker">
      <legend>
        Elegir de tu biblioteca de Fotos <small>({used}/5)</small>
      </legend>
      <CategoryChips photos={library} value={filter} onChange={setFilter} />
      <div className="photo-grid compact">
        {shown.map((p) => {
          const on = picked.includes(p.id);
          return (
            <label key={p.id} className={`photo-tile pick ${on ? "selected" : ""}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={!on && picked.length >= room}
                onChange={() =>
                  setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])
                }
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/product-image?path=${encodeURIComponent(p.path)}`}
                alt={p.name || "Foto de la biblioteca"}
                loading="lazy"
              />
              {on && (
                <span className="pick-mark">
                  <Check size={16} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
// Large view of the product photos; changing them is the Fotos button job.
function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const src = (path: string) => `/api/product-image?path=${encodeURIComponent(path)}`;
  return (
    <div className="gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gallery-main" src={src(images[i])} alt={`Foto ${i + 1} de ${title}`} />
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((path, n) => (
            <button
              key={path}
              className={`thumb-button ${n === i ? "on" : ""}`}
              aria-label={`Ver foto ${n + 1}`}
              aria-pressed={n === i}
              onClick={() => setI(n)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="table-thumb" src={src(path)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// Adds photos to an existing product, from the library or the computer.
function ProductPhotos({
  product,
  library,
  pending,
  run,
  done,
}: {
  product: Product;
  library: Photo[];
  pending: boolean;
  run: Run;
  done: () => void;
}) {
  const current = product.images?.length || 0;
  const [picked, setPicked] = useState<string[]>([]);
  const [uploads, setUploads] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const free = 5 - current;
  const total = picked.length + uploads.length;
  return (
    <div>
      <p className="body-copy">
        Este producto tiene <b>{current} de 5</b> fotos. Las fotos que agregues
        se usan en sus Pins (también en los ya creados).
      </p>
      {current > 0 && (
        <div className="photo-grid current">
          {product.images!.map((path, i) => (
            <figure key={path} className="photo-tile">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/product-image?path=${encodeURIComponent(path)}`}
                alt={`Foto ${i + 1} de ${product.title}`}
              />
            </figure>
          ))}
        </div>
      )}
      {free <= 0 ? (
        <div className="notice error">
          Ya tiene 5 fotos. Quita fotos del producto para agregar otras.
        </div>
      ) : (
        <>
          {library.length > 0 ? (
            <LibraryPicker
              library={library}
              picked={picked}
              setPicked={setPicked}
              room={free - uploads.length}
              used={current + total}
            />
          ) : (
            <p className="body-copy">
              Tu biblioteca de Fotos está vacía. Puedes subir fotos aquí abajo o
              guardarlas primero en la pestaña Fotos.
            </p>
          )}
          <Field label="O sube desde tu computadora">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={async (e) => {
                setReading(true);
                try {
                  setUploads(await readPhotos(e.target.files, free - picked.length));
                } finally {
                  setReading(false);
                }
              }}
            />
          </Field>
          <button
            className="full"
            disabled={pending || reading || total === 0}
            onClick={async () => {
              let ok = true;
              if (picked.length)
                ok = await run(
                  { action: "attachLibraryPhotos", product_id: product.id, ids: picked },
                  "Fotos agregadas. Los Pins de este producto ya las usan.",
                );
              if (ok && uploads.length)
                ok = await run(
                  { action: "addProductImages", product_id: product.id, images: uploads },
                  "Fotos agregadas. Los Pins de este producto ya las usan.",
                );
              if (ok) done();
            }}
          >
            <Plus size={16} />
            {reading
              ? "Preparando fotos…"
              : total
                ? `Agregar ${total} ${total === 1 ? "foto" : "fotos"}`
                : "Elige fotos para agregar"}
          </button>
        </>
      )}
    </div>
  );
}
function ProductForm({
  settings,
  library,
  products,
  pending,
  submit,
}: {
  settings: Settings;
  library: Photo[];
  products: Product[];
  pending: boolean;
  submit: (data: Record<string, unknown>) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [notes, setNotes] = useState("");
  // Details fill themselves from the name until you type your own.
  const [notesAuto, setNotesAuto] = useState(true);
  const [store, setStore] = useState<StoreId>("amazon");
  const writeNotes = (v: string) => {
    setNotes(v);
    setNotesAuto(!v.trim());
  };
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const fixedTitle = cleanProductName(title);
  const fixedCategory = title.trim() || category.trim() ? detectCategory(title, category) : "";
  const room = 5 - photos.length;
  const ids = useId();
  const titles = remembered(products.map((p) => p.title));
  const categories = remembered([
    ...CATEGORIES,
    ...products.map((p) => p.category),
    ...library.map((p) => p.category),
  ]);
  const pastNotes = remembered(products.map((p) => p.notes));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        f.delete("photos");
        submit({
          action: "addProduct",
          ...Object.fromEntries(f),
          images: photos,
          library: picked,
        });
      }}
    >
      <p className="body-copy">
        Introduce información verificada por ti y sube fotos del producto. Las
        fotos se usan en el diseño del Pin.
      </p>
      <Field label="Tienda">
        <select
          name="store"
          value={store}
          onChange={(e) => setStore(e.target.value as StoreId)}
        >
          {(Object.keys(STORES) as StoreId[]).map((k) => (
            <option key={k} value={k}>
              {STORES[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          store === "amazon"
            ? "URL de Amazon o ASIN"
            : `Link de afiliado de ${STORES[store]} (de Impact)`
        }
      >
        <input
          name="input"
          placeholder={
            store === "amazon"
              ? "https://www.amazon.com/dp/…"
              : `https://goto.${store}.com/c/…`
          }
          required
          maxLength={2048}
        />
        {store !== "amazon" && (
          <small className="field-fix">
            En Impact: Create link → pega la página del producto de{" "}
            {STORES[store]} → copia el link largo aquí.
          </small>
        )}
      </Field>
      <Field label="Nombre del producto">
        <Combo
          name="title"
          list={`${ids}-titles`}
          placeholder="Un nombre claro para tu colección"
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (notesAuto) setNotes(suggestDetails(e.target.value));
          }}
        />
        {title.trim() && fixedTitle !== title.trim() && (
          <small className="field-fix">Se guardará como: {fixedTitle}</small>
        )}
      </Field>
      <div className="form-grid">
        {store === "amazon" ? (
          <Field label="Marketplace para ASIN">
            <select name="marketplace" defaultValue={settings.marketplace}>
              {marketplaces.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        ) : (
          <input type="hidden" name="marketplace" value={settings.marketplace} />
        )}
        <Field label="Categoría">
          <Combo
            name="category"
            list={`${ids}-categories`}
            placeholder="Se elige sola si la dejas vacía"
            maxLength={80}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          {fixedCategory && fixedCategory !== category.trim() && (
            <small className="field-fix">La app usará: {fixedCategory}</small>
          )}
        </Field>
      </div>
      <datalist id={`${ids}-titles`}>
        {titles.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id={`${ids}-categories`}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Field label="Detalles verificados (opcional)">
        {pastNotes.length > 0 && (
          <select
            aria-label="Usar detalles de antes"
            value=""
            onChange={(e) => writeNotes(e.target.value)}
          >
            <option value="">Usar detalles de antes…</option>
            {pastNotes.map((n) => (
              <option key={n} value={n}>
                {n.length > 90 ? n.slice(0, 90) + "…" : n}
              </option>
            ))}
          </select>
        )}
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => writeNotes(e.target.value)}
          placeholder="Se llenan solos con el nombre: Waterproof, Queen Size…"
        />
        {notesAuto && notes && (
          <small className="field-fix">
            Sacados del nombre del producto. Corrígelos si hace falta.
          </small>
        )}
      </Field>
      {library.length > 0 && (
        <LibraryPicker
          library={library}
          picked={picked}
          setPicked={setPicked}
          room={room}
          used={picked.length + photos.length}
        />
      )}
      <Field
        label={
          library.length
            ? "O sube fotos nuevas (hasta 5 en total)"
            : "Fotos del producto (hasta 5)"
        }
      >
        <input
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={async (e) => {
            setReading(true);
            try {
              setPhotos(await readPhotos(e.target.files, 5 - picked.length));
            } finally {
              setReading(false);
            }
          }}
        />
      </Field>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`Foto ${i + 1}`}
              style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }}
            />
          ))}
        </div>
      )}
      <button className="full" disabled={pending || reading}>
        <Plus size={16} /> {reading ? "Preparando fotos…" : "Guardar producto"}
      </button>
    </form>
  );
}
function StudioTools({
  data,
  run,
  pending,
  openManual,
}: {
  data: Snapshot;
  run: Run;
  pending: boolean;
  openManual: () => void;
}) {
  const [product, setProduct] = useState(data.products[0]?.id || ""),
    [ai, setAi] = useState(data.aiEnabled && data.settings.mode !== "manual");
  return (
    <section className="panel studio-tools">
      <div>
        <h2>Un producto. Tres posibilidades.</h2>
        <p>Elige tu punto de partida y crea variaciones para revisar.</p>
      </div>
      <div className="studio-controls">
        <Field label="Producto">
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Selecciona un producto</option>
            {data.products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={ai}
            disabled={!data.aiEnabled}
            onChange={(e) => setAi(e.target.checked)}
          />{" "}
          Usar IA de textos {data.aiEnabled ? "" : "(requiere configuración)"}
        </label>
        <div className="button-row">
          <button
            disabled={pending || !product}
            onClick={() =>
              run(
                { action: "generate", product_id: product, ai },
                "Tres conceptos nuevos listos para revisar",
              )
            }
          >
            <Sparkles size={16} /> Generar conceptos
          </button>
          <button
            className="secondary"
            disabled={!data.products.length}
            onClick={openManual}
          >
            Crear manual
          </button>
        </div>
        <small>
          Sin IA se usan textos base editables. Regenerar crea tres variantes
          nuevas.
        </small>
      </div>
    </section>
  );
}
function CreativeForm({
  creative,
  data,
  pending,
  submit,
}: {
  creative: Creative | null;
  data: Snapshot;
  pending: boolean;
  submit: (body: Record<string, unknown>) => void;
}) {
  const [template, setTemplate] = useState(creative?.template || "editorial");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const c = {
          title: String(f.get("title")),
          description: String(f.get("description")),
          keywords: String(f.get("keywords"))
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          alt_text: String(f.get("alt_text")),
          cta: String(f.get("cta")),
          board_id: f.get("board_id") || null,
          campaign_id: f.get("campaign_id") || null,
          template,
        };
        submit(
          creative
            ? {
                action: "editCreative",
                id: creative.id,
                revision: creative.revision,
                creative: c,
              }
            : {
                action: "createCreative",
                product_id: f.get("product_id"),
                creative: c,
              },
        );
      }}
    >
      {!creative && (
        <Field label="Producto">
          <select name="product_id" required>
            {data.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Título">
        <input
          name="title"
          defaultValue={creative?.title}
          minLength={3}
          maxLength={100}
          required
        />
      </Field>
      <Field label="Descripción">
        <textarea
          name="description"
          rows={4}
          defaultValue={creative?.description}
          minLength={10}
          maxLength={600}
          required
        />
      </Field>
      <div className="form-grid">
        <Field label="Board">
          <select name="board_id" defaultValue={creative?.board_id || ""}>
            <option value="">Seleccionar board</option>
            {data.boards.filter((b) => !b.archived).map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Plantilla">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="editorial">Editorial</option>
            <option value="minimal">Minimal</option>
            <option value="bold">Bold</option>
            <option value="spotlight">Spotlight</option>
            <option value="split">Split</option>
            <option value="frame">Frame</option>
          </select>
        </Field>
      </div>
      <Field label="Keywords separadas por comas (hasta 12)">
        <input
          name="keywords"
          defaultValue={creative?.keywords.join(", ")}
          maxLength={600}
        />
      </Field>
      <Field label="Texto alternativo">
        <textarea
          name="alt_text"
          defaultValue={creative?.alt_text}
          minLength={5}
          maxLength={500}
          required
          rows={2}
        />
      </Field>
      <Field label="Llamada a la acción">
        <input
          name="cta"
          defaultValue={creative?.cta || "Ver detalles en Amazon"}
          minLength={2}
          maxLength={60}
          required
        />
      </Field>
      <Field label="Campaña (opcional)">
        <select name="campaign_id" defaultValue={creative?.campaign_id || ""}>
          <option value="">Sin campaña</option>
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="disclosure-preview">
        <ShieldCheck size={15} />
        <p>
          <b>Disclosure añadido al publicar</b>
          <br />
          {data.settings.disclosure}
        </p>
      </div>
      <button className="full" disabled={pending}>
        Guardar para revisión
      </button>
    </form>
  );
}
function ScheduleForm({
  timezone,
  pending,
  submit,
}: {
  timezone: string;
  pending: boolean;
  submit: (date: string) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          new Date(
            String(new FormData(e.currentTarget).get("when")),
          ).toISOString(),
        );
      }}
    >
      <p className="body-copy">
        Selecciona la fecha en la zona horaria de tu dispositivo. La cola la
        mostrará en {timezone}. El trabajo se ejecutará en la primera revisión
        del scheduler posterior a esa hora.
      </p>
      <Field label="Fecha y hora local del dispositivo">
        <input
          type="datetime-local"
          name="when"
          required
          min={new Date(
            Date.now() + 60000 - new Date().getTimezoneOffset() * 60000,
          )
            .toISOString()
            .slice(0, 16)}
        />
      </Field>
      <button disabled={pending}>
        <CalendarDays size={16} /> Confirmar programación
      </button>
    </form>
  );
}

// Which design and which kind of title bring more clicks, from every Pin
// published so far. Below 500 impressions a group is not judged yet: early
// numbers on a new account mislead.
const titleKind = (t: string) =>
  /save for later/i.test(t)
    ? "Guárdalo para después"
    : /for your .* routine|for your/i.test(t)
      ? "Para tu rutina"
      : t.includes(": ")
        ? "Búsqueda: nombre"
        : "Solo el nombre";
function WhatWorks({ data }: { data: Snapshot }) {
  type Row = { pins: number; imp: number; saves: number; clicks: number };
  const groups: Record<"Diseño" | "Tipo de título", Map<string, Row>> = {
    Diseño: new Map(),
    "Tipo de título": new Map(),
  };
  for (const pub of data.publications) {
    const c = data.creatives.find((x) => x.id === pub.creative_id);
    const ms = data.metrics.filter((m) => m.publication_id === pub.id);
    const sum = (k: "impressions" | "saves" | "outbound_clicks") =>
      ms.reduce((t, m) => t + (m[k] ?? 0), 0);
    const add = (map: Map<string, Row>, key: string) => {
      const r = map.get(key) || { pins: 0, imp: 0, saves: 0, clicks: 0 };
      r.pins++;
      r.imp += sum("impressions");
      r.saves += sum("saves");
      r.clicks += sum("outbound_clicks");
      map.set(key, r);
    };
    add(groups.Diseño, pub.template);
    if (c) add(groups["Tipo de título"], titleKind(c.title));
  }
  if (!data.publications.length) return null;
  return (
    <section className="panel what-works">
      <div className="panel-heading">
        <h2>Qué funciona</h2>
        <span className="subtle-pill">TODOS LOS PINS PUBLICADOS</span>
      </div>
      <p className="muted">
        Clics por cada 100 vistas, por diseño y por tipo de título. Con menos
        de 500 vistas un grupo dice «Faltan datos»: es muy pronto para elegir.
      </p>
      {(Object.keys(groups) as (keyof typeof groups)[]).map((name) => (
        <table key={name}>
          <thead>
            <tr>
              <th>{name}</th>
              <th>Pins</th>
              <th>Vistas</th>
              <th>Guardados</th>
              <th>Clics</th>
              <th>Clics / 100 vistas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {[...groups[name].entries()]
              .sort((a, b) => b[1].imp - a[1].imp)
              .map(([key, r]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{r.pins}</td>
                  <td>{r.imp}</td>
                  <td>{r.saves}</td>
                  <td>{r.clicks}</td>
                  <td>{r.imp ? ((r.clicks / r.imp) * 100).toFixed(1) : "–"}</td>
                  <td>{r.imp < 500 ? "Faltan datos" : "Comparable"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}

function Analytics({
  data,
  run,
  pending,
}: {
  data: Snapshot;
  run: Run;
  pending: boolean;
}) {
  const [days, setDays] = useState(30),
    [group, setGroup] = useState<
      "product_id" | "template" | "board_id" | "hour"
    >("product_id");
  const metrics = data.metrics.filter(
    (m) =>
      m.date >=
      new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
  );
  const total = aggregate(metrics),
    rows = breakdown(data.publications, metrics, group, data.settings.timezone);
  const label = (key: string) =>
    group === "product_id"
      ? data.products.find((p) => p.id === key)?.title || key
      : group === "board_id"
        ? data.boards.find((b) => b.id === key)?.name || key
        : key;
  return (
    <>
      <WhatWorks data={data} />
      <div className="analytics-toolbar">
        <select
          aria-label="Periodo de análisis"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
        </select>
        <button
          className="secondary"
          disabled={pending || !data.connected}
          onClick={() =>
            run(
              { action: "syncAnalytics" },
              "Métricas sincronizadas desde Pinterest",
            )
          }
        >
          <BarChart3 size={16} /> Sincronizar Pinterest
        </button>
      </div>
      <div className="metrics-grid">
        <Stat
          label="Impresiones"
          value={number(total.impressions)}
          foot="Veces que se mostraron tus Pins"
          icon={BarChart3}
        />
        <Stat
          label="Guardados"
          value={number(total.saves)}
          foot="Pins guardados por la audiencia"
          icon={CheckCheck}
        />
        <Stat
          label="Clics salientes"
          value={number(total.clicks)}
          foot="Visitas al destino del Pin"
          icon={ArrowUpRight}
        />
        <Stat
          label="CTR"
          value={total.ctr === null ? "—" : `${total.ctr.toFixed(2)}%`}
          foot="Clics salientes ÷ impresiones"
          icon={Compass}
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Rendimiento por dimensión</h2>
            <p>Agregación ponderada de métricas diarias de Pinterest.</p>
          </div>
          <select
            aria-label="Agrupar métricas"
            value={group}
            onChange={(e) => setGroup(e.target.value as typeof group)}
          >
            <option value="product_id">Producto</option>
            <option value="template">Plantilla</option>
            <option value="board_id">Board</option>
            <option value="hour">Hora de publicación</option>
          </select>
        </div>
        {metrics.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dimensión</th>
                  <th>Impresiones</th>
                  <th>Guardados</th>
                  <th>Clics</th>
                  <th>CTR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td>{label(r.name)}</td>
                    <td>{number(r.impressions)}</td>
                    <td>{number(r.saves)}</td>
                    <td>{number(r.clicks)}</td>
                    <td>{r.ctr === null ? "—" : `${r.ctr.toFixed(2)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={BarChart3}
            title="Los datos llegarán con tus publicaciones"
          >
            No hay métricas importadas para este periodo. Pinterest puede tardar
            en entregar datos; una ausencia no se interpreta como cero.
          </Empty>
        )}
      </section>
      <p className="fine-print">
        Fechas de métricas en UTC. Hora de publicación agrupada en{" "}
        {data.settings.timezone}. La sincronización recoge los últimos 30 días
        completos de hasta 20 Pins por solicitud y rota por los menos recientes.
        No mide ventas ni comisiones de Amazon.
      </p>
    </>
  );
}

function SettingsPanel({
  data,
  pending,
  run,
  connect,
  login,
  connectInstagram,
}: {
  data: Snapshot;
  pending: boolean;
  run: Run;
  connect: () => void;
  login: () => void;
  connectInstagram: () => void;
}) {
  const [s, setS] = useState(data.settings);
  const change = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setS((old) => ({ ...old, [key]: value }));
  return (
    <div className="settings-layout">
      <div>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>Conexiones</h2>
            <ShieldCheck size={19} />
          </div>
          <div className="integration-row">
            <span className="integration-logo amazon">a</span>
            <div>
              <h3>Amazon Associates & Storefront</h3>
              <p>
                {data.settings.tracking_id
                  ? "Tracking configurado · entrada manual"
                  : "Añade tu tracking ID abajo"}
              </p>
            </div>
            <Badge
              status={data.settings.tracking_id ? "Configurado" : "Pendiente"}
            />
          </div>
          <div className="integration-row">
            <span className="integration-logo pinterest">P</span>
            <div>
              <h3>Pinterest Business</h3>
              <p>
                {data.connected
                  ? "OAuth conectado · tokens protegidos"
                  : "Conecta tu cuenta para publicar y medir"}
              </p>
            </div>
            <button
              className="secondary"
              disabled={pending || !data.email}
              onClick={connect}
            >
              {data.connected ? "Reconectar" : "Conectar"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="integration-row">
            <span className="integration-logo instagram">IG</span>
            <div>
              <h3>Instagram (Reels)</h3>
              <p>
                {data.instagram
                  ? `Conectado como @${data.instagram.username} · el video de cada producto sale como Reel con su primer Pin`
                  : "Conecta la cuenta profesional para publicar los videos como Reels"}
              </p>
            </div>
            <button
              className="secondary"
              disabled={pending || !data.email}
              onClick={connectInstagram}
            >
              {data.instagram ? "Reconectar" : "Conectar"}
              <ArrowUpRight size={15} />
            </button>
          </div>
          {data.connected && (
            <div className="board-tools">
              <button
                className="secondary"
                disabled={pending}
                onClick={() =>
                  run({ action: "syncBoards" }, "Boards sincronizados")
                }
              >
                Sincronizar boards
              </button>
              <button
                className="secondary"
                disabled={pending}
                onClick={() =>
                  run(
                    { action: "describeBoards" },
                    "Descripciones escritas en los boards de tema que no tenían.",
                  )
                }
              >
                Describir boards
              </button>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await run(
                      {
                        action: "createBoard",
                        name: new FormData(form).get("name"),
                      },
                      "Board creado",
                    )
                  )
                    form.reset();
                }}
              >
                <input
                  name="name"
                  placeholder="Nombre del nuevo board"
                  aria-label="Nombre del nuevo board"
                  maxLength={50}
                  required
                />
                <button disabled={pending}>Crear board</button>
              </form>
            </div>
          )}
          {!data.email && data.configured && (
            <button className="secondary" onClick={login}>
              Iniciar sesión
            </button>
          )}
          <p className="fine-print">
            {data.boards.filter((b) => !b.archived).length} boards disponibles ·{" "}
            {data.aiEnabled
              ? "IA de textos configurada"
              : "Plantillas activas · IA de textos sin configurar"}
          </p>
        </section>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await run(
              { action: "settings", settings: s },
              "Preferencias guardadas",
            );
          }}
        >
          <section className="panel settings-panel">
            <h2>Tu forma de trabajar</h2>
            <div className="mode-options">
              {(
                [
                  {
                    id: "manual",
                    title: "Manual",
                    text: "Tú eliges y preparas cada Pin.",
                  },
                  {
                    id: "assisted",
                    title: "AI Assisted",
                    text: "Genera propuestas y decide qué publicar.",
                  },
                  {
                    id: "autopilot",
                    title: "Autopilot",
                    text: "Crea desde tu catálogo, con tus límites.",
                  },
                ] as const
              ).map((m) => (
                <label key={m.id} className={s.mode === m.id ? "selected" : ""}>
                  <input
                    type="radio"
                    name="mode"
                    value={m.id}
                    checked={s.mode === m.id}
                    onChange={() => change("mode", m.id)}
                  />
                  <strong>{m.title}</strong>
                  <small>{m.text}</small>
                </label>
              ))}
            </div>
            <label className="toggle-row">
              <div>
                <b>Revisión antes de publicar</b>
                <small>
                  Siempre activa: Pinterest pide que elijas cada Pin que la
                  app publica. Tú tocas Aprobar en cada uno y la app hace el
                  resto.
                </small>
              </div>
              <input type="checkbox" checked readOnly disabled />
            </label>
            {s.mode === "autopilot" && (
              <label className="toggle-row">
                <div>
                  <b>Activar Autopilot</b>
                  <small>
                    Cada producto nuevo con fotos recibe 3 Pins (otra foto,
                    diseño y board en cada uno). Se publican solos: 1 por
                    producto al día, máximo por día y entre 9 am y 9 pm
                    (Nueva York). Tú apruebas cada Pin con un toque en
                    Approval Queue.
                  </small>
                </div>
                <input
                  type="checkbox"
                  checked={s.autopilot_enabled}
                  onChange={(e) =>
                    change("autopilot_enabled", e.target.checked)
                  }
                />
              </label>
            )}
            <div className="form-grid">
              <Field label="Máximo de Pins por día">
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={s.daily_limit}
                  onChange={(e) =>
                    change("daily_limit", Number(e.target.value))
                  }
                  required
                />
              </Field>
              <Field label="Intervalo mínimo (minutos)">
                <input
                  type="number"
                  min={60}
                  max={1440}
                  value={s.min_interval_minutes}
                  onChange={(e) =>
                    change("min_interval_minutes", Number(e.target.value))
                  }
                  required
                />
              </Field>
            </div>
            <Field label="Zona horaria de visualización">
              <input
                value={s.timezone}
                onChange={(e) => change("timezone", e.target.value)}
                placeholder="America/New_York"
                required
              />
            </Field>
            <Field label="Board predeterminado">
              <select
                value={s.default_board_id || ""}
                onChange={(e) =>
                  change("default_board_id", e.target.value || null)
                }
              >
                <option value="">Seleccionar board</option>
                {data.boards.filter((b) => !b.archived).map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </section>
          <section className="panel settings-panel">
            <h2>Afiliación y transparencia</h2>
            <div className="form-grid">
              <Field label="Amazon tracking ID">
                <input
                  value={s.tracking_id}
                  onChange={(e) => change("tracking_id", e.target.value)}
                  placeholder="tu-identificador-20"
                  maxLength={80}
                />
              </Field>
              <Field label="Marketplace predeterminado">
                <select
                  value={s.marketplace}
                  onChange={(e) => change("marketplace", e.target.value)}
                >
                  {marketplaces.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="URL de tu Storefront (opcional)">
              <input
                type="url"
                value={s.storefront_url}
                onChange={(e) => change("storefront_url", e.target.value)}
                placeholder="https://www.amazon.com/shop/tu-nombre"
              />
            </Field>
            <Field label="Disclosure de afiliación">
              <textarea
                value={s.disclosure}
                onChange={(e) => change("disclosure", e.target.value)}
                minLength={15}
                maxLength={180}
                rows={3}
                required
              />
            </Field>
            <p className="fine-print">
              Se añade al inicio de la descripción y a la creatividad. Cambiar
              el disclosure o tracking cancela las programaciones pendientes y
              exige nueva aprobación. Verifica el tracking para el marketplace
              de cada producto.
            </p>
            <button disabled={pending || !data.email}>
              <Check size={16} /> Guardar preferencias
            </button>
          </section>
        </form>
        <section className="panel settings-panel">
          <h2>Campañas</h2>
          <p className="body-copy">
            Agrupa conceptos de una misma iniciativa al editarlos.
          </p>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (
                await run(
                  {
                    action: "createCampaign",
                    name: new FormData(f).get("name"),
                  },
                  "Campaña creada",
                )
              )
                f.reset();
            }}
          >
            <input
              name="name"
              aria-label="Nombre de campaña"
              placeholder="Nueva campaña"
              maxLength={100}
              required
            />
            <button disabled={pending}>Crear</button>
          </form>
          {data.campaigns.map((c) => (
            <span className="campaign-chip" key={c.id}>
              {c.name}
            </span>
          ))}
        </section>
      </div>
      <aside>
        <section className="panel setup-guide">
          <span className="empty-icon">
            <ShieldCheck size={25} />
          </span>
          <h2>Activa tu workspace</h2>
          <ol>
            <li>
              <b>Supabase</b>
              <p>
                Aplica la migración incluida y crea tu usuario en
                Authentication.
              </p>
            </li>
            <li>
              <b>Variables del servidor</b>
              <p>
                Copia .env.example a .env.local. Completa los valores reales en
                local o en Vercel.
              </p>
            </li>
            <li>
              <b>Pinterest Developers</b>
              <p>
                Registra el callback /api/pinterest/callback, configura App ID y
                Secret y conecta tu cuenta.
              </p>
            </li>
            <li>
              <b>Verifica el flujo</b>
              <p>
                Añade un producto, genera, revisa, aprueba y programa tu primer
                Pin.
              </p>
            </li>
          </ol>
          <p className="fine-print">
            Consulta README.md para los pasos exactos, requisitos de cron y
            validación de conexiones.
          </p>
        </section>
        <div className="security-note">
          <ShieldCheck size={18} />
          <p>
            Los secretos y tokens de las integraciones permanecen en el
            servidor.
          </p>
        </div>
      </aside>
    </div>
  );
}
