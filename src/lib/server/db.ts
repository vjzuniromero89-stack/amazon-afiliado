import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
export function env(name: string) {
  const value = process.env[name];
  if (!value)
    throw new AppError(`Falta configurar ${name} en el servidor.`, 503);
  return value;
}
export function admin() {
  return createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function session() {
  const jar = await cookies();
  return createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server component: proxy handles refresh. */
          }
        },
      },
    },
  );
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function userId() {
  if (!configured())
    throw new AppError(
      "Configura Supabase para guardar datos y conectar Pinterest.",
      503,
    );
  const sb = await session();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user)
    throw new AppError("Inicia sesión para continuar.", 401);
  return data.user.id;
}
export function check<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (error) {
    if (error.code === "23505")
      throw new AppError("Este registro ya existe. No se permiten duplicados.");
    throw new AppError(error.message);
  }
  return data as NonNullable<T>;
}
export async function owned(table: string, id: string, uid: string) {
  const row = check(
    await admin()
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle(),
  );
  if (!row) throw new AppError("Registro no encontrado.", 404);
  return row;
}
export function originGuard(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(env("APP_URL")).origin)
    throw new AppError("Origen de solicitud no permitido.", 403);
}
export function errorResponse(e: unknown) {
  if (e instanceof AppError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof Error && e.name === "ZodError")
    return Response.json(
      { error: "Revisa los campos: hay valores inválidos." },
      { status: 400 },
    );
  console.error("Request failed:", e instanceof Error ? e.name : "unknown");
  return Response.json(
    {
      error:
        "No se pudo completar la operación. Revisa la configuración e inténtalo de nuevo.",
    },
    { status: 500 },
  );
}
