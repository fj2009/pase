export class AppError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "validation"
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "conflict"
      | "unavailable"
      | "internal" = "internal",
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function userMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code === "23505") {
    return "Ya existe un registro con esos datos.";
  }
  if (pgError?.code === "23503") {
    return "La operación hace referencia a un dato que ya no existe.";
  }
  if (pgError?.code === "42501") {
    return "No tienes permisos para realizar esta operación.";
  }
  console.error("[app]", error);
  return "No se ha podido completar la operación. Inténtalo de nuevo.";
}
