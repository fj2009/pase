import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { getStaffContext, homeForRole } from "@/features/auth/session";
import { env } from "@/lib/env";

export const metadata = { title: "Acceso del personal" };

export default async function LoginPage() {
  const context = await getStaffContext();
  if (context) {
    redirect(context.role ? homeForRole(context.role) : "/plataforma");
  }

  return (
    <main id="contenido" className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-olive-deep px-10 py-12 text-paper lg:flex lg:flex-col lg:justify-between">
        <Logo subdued />
        <div className="max-w-lg">
          <p className="label !text-paper/50">Acceso del personal</p>
          <h1 className="mt-5 text-balance font-display text-5xl font-normal leading-[1.04] tracking-[-0.02em]">
            La sala y la cocina,
            <br />
            <span className="italic text-paper/70">en el mismo pase.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-paper/65">
            Este acceso es solo para el equipo del restaurante. Los clientes
            consultan la carta con el QR de su mesa, sin cuenta ni contraseña.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-paper/15 pt-6 text-xs text-paper/55">
          <p>Comandas</p>
          <p>Pase de cocina</p>
          <p>Cuenta y seguimiento</p>
        </div>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <Link
            href="/carta/casa-aurelio"
            className="inline-flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Volver a la carta
          </Link>
        </div>

        <div className="my-auto w-full max-w-sm self-center py-12">
          <p className="label mb-2">Pase · personal</p>
          <h2 className="text-3xl font-semibold tracking-[-0.04em]">Entrar</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Usa la cuenta que te haya facilitado el propietario del restaurante.
          </p>
          <div className="mt-8">
            <LoginForm showDemo={env.PASE_ENV !== "production"} />
          </div>
        </div>

        <p className="text-center text-xs text-ink-faint">
          Plataforma de gestión hostelera · España · EUR
        </p>
      </section>
    </main>
  );
}
