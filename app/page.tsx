import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  CreditCard,
  QrCode,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/button";

const modules = [
  {
    index: "01",
    icon: QrCode,
    title: "Carta digital",
    text: "El cliente escanea el QR de su mesa y consulta la carta actualizada, con alérgenos, disponibilidad y precio. Sin instalar nada.",
  },
  {
    index: "02",
    icon: Users,
    title: "Sala",
    text: "El equipo registra la comanda desde el panel, añade platos a una mesa abierta y ve qué falta por salir. El cliente no pide desde el móvil.",
  },
  {
    index: "03",
    icon: ChefHat,
    title: "Pase de cocina",
    text: "Una pantalla por estación, ordenada por antigüedad y carga real. Empezar, listo, incidencia y entrega sin cambiar de ventana.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Principal">
          <Link href="/carta/casa-aurelio" className={buttonClass("ghost", "sm")}>
            Carta de demostración
          </Link>
          <Link href="/entrar" className={buttonClass("secondary", "sm")}>
            Acceso personal
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="mx-auto grid max-w-6xl border-y border-line lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
            <p className="label mb-6">Software de sala y cocina</p>
            <h1 className="text-balance text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              El servicio,
              <br />
              <span className="font-display font-normal italic tracking-[-0.02em] text-olive">
                de principio a fin.
              </span>
            </h1>
            <p className="mt-7 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
              Pase conecta la carta del cliente, la comanda de sala y el pase de
              cocina en una sola herramienta. Tiempos estimados con la carga real
              del servicio, no temporizadores decorativos.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/carta/casa-aurelio" className={buttonClass("primary", "lg")}>
                Ver una carta real
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/entrar" className={buttonClass("secondary", "lg")}>
                Entrar al panel
              </Link>
            </div>
            <p className="mt-6 max-w-md text-xs leading-relaxed text-ink-faint">
              Demostración con un restaurante ficticio y datos de ejemplo. Ninguna
              cifra de esta página es una estadística comercial.
            </p>
          </div>

          <div className="relative min-h-[340px] border-t border-line bg-paper-deep lg:min-h-[620px] lg:border-l lg:border-t-0">
            <Image
              src="/demo/portada.jpg"
              alt="Pulpo a la brasa servido en plato de pizarra"
              fill
              priority
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/25 to-transparent p-5 pt-20 sm:p-7">
              <div className="ml-auto max-w-xs border border-paper/25 bg-paper/95 p-4 text-ink shadow-lift backdrop-blur-[1px]">
                <div className="flex items-center justify-between">
                  <span className="meta-mono">Mesa 4 · 21:42</span>
                  <span className="border border-ok/30 bg-ok-soft px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider text-ok">
                    En cocina
                  </span>
                </div>
                <p className="mt-2 font-display text-xl leading-tight">
                  Pulpo a la brasa
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  1 ración · sin gluten añadido
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs">
                  <span className="text-ink-faint">Tiempo estimado</span>
                  <span className="font-mono">8–12 min</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="label mb-2">Tres piezas, un servicio</p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em]">
                Cada pantalla, para lo que hace falta.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
              La carta se lee. La sala opera. La cocina cocina. No mezclamos las
              tres en la misma interfaz.
            </p>
          </div>

          <div className="grid border-t border-line md:grid-cols-3">
            {modules.map((item) => (
              <article
                key={item.index}
                className="group border-b border-line py-7 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0"
              >
                <div className="flex items-center justify-between">
                  <item.icon className="h-5 w-5 text-olive" strokeWidth={1.5} aria-hidden />
                  <span className="meta-mono">{item.index}</span>
                </div>
                <h3 className="mt-8 text-lg font-medium tracking-[-0.015em]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-paper-raised">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="label mb-3">Cómo está construido</p>
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em]">
                Datos separados por restaurante. Permisos por rol. Nada de atajos.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
                Cada operación se valida en servidor y en PostgreSQL. El
                restaurante no viaja en la petición del navegador: se resuelve
                desde la sesión y las políticas de fila.
              </p>
            </div>
            <ul className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: "Aislamiento con RLS",
                  text: "Row Level Security activada y forzada en todas las tablas de negocio. Un restaurante no ve los datos de otro.",
                },
                {
                  icon: Timer,
                  title: "Estimación con cola real",
                  text: "Se tiene en cuenta la carga por estación y la capacidad de trabajo en paralelo. Se muestra un intervalo, nunca una hora falsa.",
                },
                {
                  icon: CreditCard,
                  title: "Cuenta, no cobro",
                  text: "El cliente solicita la cuenta y sala la atiende. La primera versión no procesa pagos ni emite facturas.",
                },
                {
                  icon: ChefHat,
                  title: "Impresión con agente local",
                  text: "La web encola trabajos; un agente instalado en el restaurante los imprime por red o USB. Sin exponer la impresora a internet.",
                },
              ].map((item) => (
                <li key={item.title}>
                  <item.icon className="h-5 w-5 text-olive" strokeWidth={1.5} aria-hidden />
                  <p className="mt-3 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="label mb-2">Pruébalo con datos de ejemplo</p>
            <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
              La carta de Casa Aurelio incluye una mesa con servicio abierto. Entra
              con el perfil de sala y registra una comanda; después cambia el estado
              desde cocina y abre el seguimiento.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/carta/casa-aurelio?mesa=casa04c4d5e6f708192a3b4c5d6e7f8091a2b" className={buttonClass("primary")}>
              Abrir mesa 4
            </Link>
            <Link href="/entrar" className={buttonClass("secondary")}>
              Acceso
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo className="text-ink" />
          <p>
            Producto en desarrollo · Datos de demostración · Fotografías:{" "}
            <a
              href="https://commons.wikimedia.org"
              className="link"
              target="_blank"
              rel="noreferrer"
            >
              Wikimedia Commons
            </a>{" "}
            · <a href="/demo/CREDITS.md" className="link">Créditos</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
