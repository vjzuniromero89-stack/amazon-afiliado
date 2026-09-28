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
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Compass,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LogOut,
  Menu,
  Package,
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
import { aggregate, breakdown, insights, marketplaces } from "@/lib/domain";
import type { Creative, Settings, Snapshot } from "@/lib/types";

export const sections = [
  "dashboard",
  "products",
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
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
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
function TemplatePreview({
  template = "editorial",
  title = "Pequeños hallazgos. Grandes ideas.",
  cta = "Descubre tu próximo favorito",
  disclosure = "Ejemplo de plantilla · Sin producto asociado",
}: {
  template?: string;
  title?: string;
  cta?: string;
  disclosure?: string;
}) {
  return (
    <div className={`pin-preview ${template}`}>
      <span className="pin-eyebrow">THE EVERYDAY EDIT</span>
      <div className="pin-center">
        <div className="pin-orb" />
        <strong>{title}</strong>
        <p>
          Pequeños descubrimientos.
          <br />
          Nuevas posibilidades.
        </p>
      </div>
      <div>
        <span className="pin-cta">
          {cta} <ArrowUpRight size={14} />
        </span>
        <small>{disclosure}</small>
      </div>
    </div>
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
  function schedule(c: Creative) {
    setScheduling(c);
    setModal("schedule");
  }
  const cards = (items: Creative[]) =>
    items.length ? (
      <div className="creative-grid">
        {items.map((c) => (
          <article key={c.id} className="creative-card">
            <div className="creative-image">
              <Image
                unoptimized
                src={`/api/artwork/${c.id}?v=${c.revision}`}
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
              <p className="disclosure-line">{data.settings.disclosure}</p>
              <p className="board-line">
                Board:{" "}
                {data.boards.find((b) => b.id === c.board_id)?.name ||
                  "Por seleccionar"}
              </p>
              <div className="card-actions">
                {!["queued", "published"].includes(c.status) && (
                  <button className="secondary" onClick={() => edit(c)}>
                    Editar
                  </button>
                )}
                {["draft", "rejected"].includes(c.status) && (
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(
                        { action: "approve", id: c.id },
                        "Pin aprobado. Ya puedes programarlo.",
                      )
                    }
                  >
                    <Check size={15} /> Aprobar
                  </button>
                )}
                {c.status === "approved" && (
                  <button onClick={() => schedule(c)}>
                    <CalendarDays size={15} /> Programar
                  </button>
                )}
                {["draft", "approved"].includes(c.status) && (
                  <button
                    className="text-button danger"
                    disabled={pending}
                    onClick={() =>
                      run({ action: "reject", id: c.id }, "Pin rechazado")
                    }
                  >
                    Rechazar
                  </button>
                )}
                {["draft", "approved", "rejected"].includes(c.status) && (
                  <button
                    className="text-button danger"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm("¿Eliminar este Pin? No se puede deshacer."))
                        run({ action: "deleteCreative", id: c.id }, "Pin eliminado");
                    }}
                  >
                    <Trash2 size={15} /> Eliminar
                  </button>
                )}
                <a
                  href={`/api/artwork/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir PNG para descargar"
                  className="icon-button"
                >
                  <ArrowDownToLine size={16} />
                  <span className="sr-only">Descargar creatividad</span>
                </a>
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
                {i === 7 && (
                  <div className="nav-label nav-divider">INTELLIGENCE</div>
                )}
                {i === 9 && <div className="nav-divider" />}
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
                  {data.settings.require_approval
                    ? "Tú tienes la última palabra"
                    : "Aprobación automática habilitada"}
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
                <div className="eyebrow">
                  AMAZON AFFILIATE COMMAND{" "}
                  <span> / {header.label.toUpperCase()}</span>
                </div>
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
                <section className="hero">
                  <div className="hero-copy">
                    <span className="hero-tag">
                      <Sparkles size={14} /> CREATIVIDAD CON DIRECCIÓN
                    </span>
                    <h2>
                      Descubre.
                      <br />
                      Crea. <em>Conecta.</em>
                    </h2>
                    <p>
                      Convierte productos que te gustan en contenido que
                      inspira. La automatización te acompaña; tú decides qué
                      publicar.
                    </p>
                    <Link className="button light" href="/pin-studio">
                      Abrir Pin Studio <ArrowUpRight size={17} />
                    </Link>
                    <div className="hero-foot">
                      <ShieldCheck size={14} /> Revisión humana activada por
                      defecto
                    </div>
                  </div>
                  <div
                    className="hero-art"
                    aria-label="Ejemplos de las plantillas verticales"
                  >
                    <div className="floating-note">
                      <CheckCheck size={16} /> De la idea al próximo Pin
                    </div>
                    <div className="hero-pin back">
                      <TemplatePreview
                        template="minimal"
                        title="Menos ruido. Más inspiración."
                      />
                    </div>
                    <div className="hero-pin front">
                      <TemplatePreview title="Tu próxima pequeña gran idea." />
                    </div>
                    <span className="art-caption">
                      PLANTILLAS INCLUIDAS · FORMATO 2:3
                    </span>
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
                      <span className="subtle-pill">SEMIAUTOMÁTICO</span>
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
                          {new Date(a.created_at).toLocaleString("es", {
                            timeZone: data.settings.timezone,
                          })}
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
                  </span>
                </div>
                {data.products.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Marketplace</th>
                          <th>Categoría</th>
                          <th>Pins</th>
                          <th />
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
                              <td>
                                <div className="table-product">
                                  <span className="product-icon">
                                    <Package size={21} />
                                  </span>
                                  <div>
                                    <b>{p.title}</b>
                                    <small>{p.asin}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{p.marketplace.replace("www.", "")}</td>
                              <td>{p.category || "Sin categoría"}</td>
                              <td>
                                {
                                  data.creatives.filter(
                                    (c) => c.product_id === p.id,
                                  ).length
                                }
                              </td>
                              <td>
                                <a
                                  className="icon-button"
                                  aria-label={`Abrir ${p.title} en Amazon`}
                                  href={p.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink size={16} />
                                </a>
                                <button
                                  className="secondary"
                                  disabled={pending}
                                  onClick={() =>
                                    run(
                                      {
                                        action: "generate",
                                        product_id: p.id,
                                        ai: data.settings.mode !== "manual",
                                      },
                                      "Tres conceptos creados en Pin Studio",
                                    )
                                  }
                                >
                                  <Sparkles size={14} /> Crear Pins
                                </button>
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

            {section === "discover" && (
              <div className="two-col">
                <section className="panel discover-card">
                  <span className="empty-icon">
                    <Compass size={28} />
                  </span>
                  <div className="eyebrow">TU CURADURÍA, PRIMERO</div>
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
                {cards(
                  data.creatives.filter((c) =>
                    ["draft", "approved", "rejected"].includes(c.status),
                  ),
                )}
              </>
            )}
            {section === "scheduler" && (
              <>
                <div className="info-strip">
                  <CalendarDays size={20} />
                  <p>
                    Horas mostradas en <b>{data.settings.timezone}</b>. Máximo{" "}
                    {data.settings.daily_limit} Pins por día UTC, separados al
                    menos {data.settings.min_interval_minutes} minutos.
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
                    <span className="subtle-pill">CRON · DIARIO · 12 UTC</span>
                  </div>
                  {data.queue.length ? (
                    <div className="queue-list">
                      {data.queue.map((q) => (
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
                              {new Date(q.scheduled_at).toLocaleString("es", {
                                timeZone: data.settings.timezone,
                              })}{" "}
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
                      ))}
                    </div>
                  ) : (
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
                              {new Date(p.published_at).toLocaleString("es", {
                                timeZone: data.settings.timezone,
                              })}
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
        {modal === "product" && (
          <Modal title="Añadir un producto" close={() => setModal(null)}>
            <ProductForm
              settings={data.settings}
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
function ProductForm({
  settings,
  pending,
  submit,
}: {
  settings: Settings;
  pending: boolean;
  submit: (data: Record<string, unknown>) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        submit({ action: "addProduct", ...Object.fromEntries(f) });
      }}
    >
      <p className="body-copy">
        Introduce información verificada por ti. La aplicación no extrae fotos,
        precios ni reseñas de Amazon.
      </p>
      <Field label="URL de Amazon o ASIN">
        <input
          name="input"
          placeholder="https://www.amazon.com/dp/…"
          required
          maxLength={2048}
        />
      </Field>
      <Field label="Nombre del producto">
        <input
          name="title"
          placeholder="Un nombre claro para tu colección"
          required
          minLength={3}
          maxLength={160}
        />
      </Field>
      <div className="form-grid">
        <Field label="Marketplace para ASIN">
          <select name="marketplace" defaultValue={settings.marketplace}>
            {marketplaces.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Categoría">
          <input
            name="category"
            placeholder="Hogar, tecnología, cocina…"
            maxLength={80}
          />
        </Field>
      </div>
      <Field label="Detalles verificados (opcional)">
        <textarea
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="Material, uso, características confirmadas…"
        />
      </Field>
      <button className="full" disabled={pending}>
        <Plus size={16} /> Guardar producto
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
        <span className="eyebrow">
          <Sparkles size={14} /> DE PRODUCTO A CONCEPTO
        </span>
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
            {data.boards.map((b) => (
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
}: {
  data: Snapshot;
  pending: boolean;
  run: Run;
  connect: () => void;
  login: () => void;
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
            {data.boards.length} boards disponibles ·{" "}
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
                  En Autopilot, desactivar permite aprobar y programar
                  automáticamente.
                </small>
              </div>
              <input
                type="checkbox"
                checked={s.require_approval}
                onChange={(e) => change("require_approval", e.target.checked)}
              />
            </label>
            {s.mode === "autopilot" && (
              <label className="toggle-row">
                <div>
                  <b>Activar Autopilot</b>
                  <small>
                    Procesa un producto nuevo al día: 3 conceptos; con revisión
                    desactivada, programa uno.
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
              <Field label="Máximo de Pins por día UTC">
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
                {data.boards.map((b) => (
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
