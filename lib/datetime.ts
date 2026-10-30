const DEFAULT_TIMEZONE = "Europe/Madrid";

export function formatTime(
  value: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

export function formatDate(
  value: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatShortDate(
  value: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatDateTime(
  value: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return `${formatShortDate(value, timeZone)} · ${formatTime(value, timeZone)}`;
}

export function minutesSince(value: Date | string, now = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(value).getTime()) / 60_000),
  );
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function elapsedLabel(value: Date | string, now = new Date()): string {
  return formatDuration(minutesSince(value, now));
}
