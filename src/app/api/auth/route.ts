import { z } from "zod";
import { errorResponse, originGuard, session, AppError } from "@/lib/server/db";
export async function POST(req: Request) {
  try {
    originGuard(req);
    const body = z
      .object({
        action: z.enum(["login", "logout"]),
        email: z.string().email().optional(),
        password: z.string().min(8).optional(),
      })
      .parse(await req.json());
    const sb = await session();
    if (body.action === "logout") {
      await sb.auth.signOut();
      return Response.json({ ok: true });
    }
    if (!body.email || !body.password)
      throw new AppError("Introduce email y contraseña.");
    const { error } = await sb.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error)
      throw new AppError(
        "No se pudo iniciar sesión. Revisa email y contraseña.",
        401,
      );
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
