import Image from "next/image";

/**
 * El ícono ya viene recortado y con fondo transparente en
 * `public/logo-deploy.png`; el original del prototipo
 * (`public/logo-deploy-original.png`) es un
 * cuadrado con fondo negro y la palabra "Deploy" incluida. El nombre va como
 * texto al lado, que a este tamaño se lee y el de la imagen no.
 */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Image src="/logo-deploy.png" alt="" width={32} height={32} priority />
      <span className="font-display text-lg font-semibold">Deploy</span>
    </span>
  );
}
