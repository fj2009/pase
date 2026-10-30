#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { connect } from "node:net";
import { Client } from "pg";
import { config } from "dotenv";

const root = join(import.meta.dirname, "..");
config({ path: join(root, ".env.local") });
config({ path: join(root, ".env") });

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const token = flag("token") ?? process.env.PRINT_AGENT_TOKEN;
const once = args.includes("--once");
const interval = Number(flag("interval") ?? process.env.PRINT_AGENT_INTERVAL ?? 3000);

const tokenHash = token
  ? createHash("sha256").update(token).digest("hex")
  : "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stopping = false;

function textWidth(paperWidth) {
  return paperWidth === 58 ? 32 : 42;
}

function money(cents) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format((Number(cents) || 0) / 100);
}

function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line.length + word.length + 1 > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatTicket(payload, paperWidth) {
  const width = textWidth(paperWidth);
  const line = "-".repeat(width);
  const out = [];
  const push = (value = "") => out.push(value);
  const center = (value) => {
    const text = String(value);
    push(text.length >= width ? text : " ".repeat(Math.floor((width - text.length) / 2)) + text);
  };
  const two = (left, right) => {
    const l = String(left);
    const r = String(right);
    const gap = Math.max(1, width - l.length - r.length);
    push(`${l}${" ".repeat(gap)}${r}`);
  };

  push("PASE");
  push(line);
  center(payload.type === "reprint" ? "COPIA DE TICKET" : payload.type === "test" ? "PRUEBA DE IMPRESIÓN" : "COMANDA");
  center(payload.restaurant?.name ?? "");
  push(line);
  two(`Comanda #${payload.order?.number ?? "-"}`, payload.order?.table ?? "");
  two(
    new Date(payload.order?.created_at ?? Date.now()).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    payload.order?.id ? payload.order.id.slice(0, 8) : "",
  );
  if (payload.order?.notes) {
    push(line);
    push("Notas de la comanda:");
    for (const entry of wrap(payload.order.notes, width)) push(entry);
  }
  push(line);

  for (const item of payload.items ?? []) {
    two(`${item.quantity}x ${item.name}`, item.station ?? "");
    if (item.notes) {
      for (const entry of wrap(`  Nota: ${item.notes}`, width)) push(entry);
    }
    if (item.allergens?.length) {
      for (const entry of wrap(`  Alérgenos: ${item.allergens.join(", ")}`, width)) {
        push(entry);
      }
    }
  }

  if (payload.total_cents != null) {
    push(line);
    two("TOTAL", money(payload.total_cents));
  }
  push(line);
  center(payload.printer?.name ?? "");
  center(new Date(payload.generated_at ?? Date.now()).toLocaleString("es-ES"));
  push("");
  push("");
  push("");
  return out.join("\n");
}

function escpos(text) {
  const body = Buffer.from(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x00-\x7F]/g, ""),
    "latin1",
  );
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    Buffer.from([0x1b, 0x74, 0x10]),
    Buffer.from([0x1b, 0x61, 0x00]),
    body,
    Buffer.from([0x0a, 0x0a, 0x0a]),
    Buffer.from([0x1d, 0x56, 0x00]),
  ]);
}

async function sendNetwork(target, bytes) {
  const [host, portText] = String(target).split(":");
  const port = Number(portText ?? 9100);
  await new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`tiempo de espera agotado al conectar con ${host}:${port}`));
    }, 8000);
    socket.on("connect", () => socket.write(bytes));
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.end();
  });
}

async function deliver(job) {
  const { printer, payload } = job;
  const width = Number(printer.paper_width) || 80;
  const text = formatTicket(payload, width);

  if (printer.kind === "network") {
    if (!printer.target) throw new Error("impresora de red sin destino host:puerto");
    await sendNetwork(printer.target, escpos(text));
    return { kind: "network", target: printer.target };
  }

  if (printer.kind === "usb_agent") {
    if (!printer.target) throw new Error("impresora USB sin ruta de dispositivo");
    await writeFile(printer.target, escpos(text));
    return { kind: "usb_agent", target: printer.target };
  }

  const target = printer.target || join(root, "agent", "out", printer.name);
  const directory = target.endsWith("/") ? target : dirname(target);
  const base = target.replace(/\/$/, "");
  const file = `${base}-${job.id.slice(0, 8)}.txt`;
  await mkdir(directory, { recursive: true });
  await writeFile(file, text, "utf8");
  return { kind: "test", target: file };
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_APP_URL });
  await client.connect();

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    console.log("\nCerrando agente de impresión…");
    await client.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Agente de impresión Pase iniciado.");
  while (!stopping) {
    let delay = once ? 0 : interval;
    try {
      const claim = await client.query("SELECT api.agent_claim($1) AS result", [
        tokenHash,
      ]);
      const result = claim.rows[0]?.result;
      if (!result?.ok) {
        console.error("Token de agente no válido o revocado.");
        await client.end();
        process.exitCode = 1;
        return;
      }
      const job = result.job;
      if (job) {
        try {
          const delivered = await deliver(job);
          await client.query("SELECT api.agent_complete($1, $2, true, NULL)", [
            tokenHash,
            job.id,
          ]);
          console.log(
            `Trabajo ${job.id.slice(0, 8)} impreso en ${delivered.kind}: ${delivered.target}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await client.query("SELECT api.agent_complete($1, $2, false, $3)", [
            tokenHash,
            job.id,
            message,
          ]);
          console.error(`Trabajo ${job.id.slice(0, 8)} fallido: ${message}`);
        }
      } else if (once) {
        console.log("No hay trabajos pendientes.");
      }
    } catch (error) {
      console.error("Error consultando la cola:", error.message);
      delay = Math.max(interval, 5000);
    }
    if (once) break;
    await sleep(delay);
  }

  await client.end();
}

if (!token) {
  console.error(
    "Falta el token del agente. Usa --token <token> o PRINT_AGENT_TOKEN.",
  );
  process.exitCode = 2;
} else if (!process.env.DATABASE_APP_URL) {
  console.error("Falta DATABASE_APP_URL en .env.local.");
  process.exitCode = 2;
} else {
  await main();
}

export { formatTicket, escpos };
