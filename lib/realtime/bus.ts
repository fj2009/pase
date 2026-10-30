import "server-only";

import { Client } from "pg";
import { env } from "@/lib/env";

export interface LiveEvent {
  topic: "orders" | "items" | "bills" | "print";
  restaurant_id: string;
  order_id?: string;
  item_id?: string;
  bill_id?: string;
  job_id?: string;
  table_id?: string;
  status?: string;
  tracking_token?: string;
}

type Subscriber = {
  filter: (event: LiveEvent) => boolean;
  send: (event: LiveEvent) => void;
};

type BusState = {
  client: Client | null;
  subscribers: Set<Subscriber>;
  reconnecting: boolean;
};

type GlobalWithBus = typeof globalThis & { paseBus?: BusState };

const globalWithBus = globalThis as GlobalWithBus;
const state: BusState =
  globalWithBus.paseBus ?? { client: null, subscribers: new Set(), reconnecting: false };
globalWithBus.paseBus = state;

function dispatch(raw: string) {
  let event: LiveEvent;
  try {
    event = JSON.parse(raw) as LiveEvent;
  } catch {
    return;
  }
  for (const subscriber of state.subscribers) {
    try {
      if (subscriber.filter(event)) subscriber.send(event);
    } catch {
      state.subscribers.delete(subscriber);
    }
  }
}

async function connect() {
  if (state.client || state.reconnecting) return;
  state.reconnecting = true;

  const client = new Client({
    connectionString: env.DATABASE_APP_URL,
    application_name: "pase-realtime",
  });
  client.on("notification", (message) => {
    if (message.channel === "pase_events" && message.payload) {
      dispatch(message.payload);
    }
  });
  client.on("error", (error) => {
    console.error("[realtime] error", error.message);
    state.client = null;
    state.reconnecting = false;
    client.end().catch(() => undefined);
    if (state.subscribers.size > 0) {
      setTimeout(connect, 2_000);
    }
  });
  client.on("end", () => {
    state.client = null;
    state.reconnecting = false;
    if (state.subscribers.size > 0) setTimeout(connect, 2_000);
  });

  try {
    await client.connect();
    await client.query("LISTEN pase_events");
    state.client = client;
  } catch (error) {
    console.error("[realtime] no se pudo conectar", error);
    state.client = null;
    setTimeout(connect, 3_000);
  } finally {
    state.reconnecting = false;
  }
}

export function subscribe(filter: Subscriber["filter"], send: Subscriber["send"]) {
  const subscriber: Subscriber = { filter, send };
  state.subscribers.add(subscriber);
  void connect();

  return () => {
    state.subscribers.delete(subscriber);
  };
}
