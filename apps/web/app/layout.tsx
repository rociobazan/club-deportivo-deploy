import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { obtenerUsuario } from "@/lib/sesion";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deploy — Club Deportivo",
  description:
    "Reservá canchas de tenis, pádel y fútbol 5 en el club Deploy, con equipamiento opcional.",
};

// Async por la sesión: leer la cookie hace dinámico al layout, y con él a todo el sitio.
// Sin cookie no llama a la API, así las páginas públicas no dependen de ella.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const usuario = await obtenerUsuario();

  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SiteHeader
          usuario={
            usuario
              ? { nombre: `${usuario.nombre} ${usuario.apellido}`, rol: usuario.rol }
              : undefined
          }
        />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
