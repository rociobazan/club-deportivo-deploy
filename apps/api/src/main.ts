import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

// En desarrollo, las variables salen de apps/api/.env (copiado de .env.example).
// loadEnvFile es nativo de Node y no pisa las que ya vienen del entorno, así el
// CI y producción siguen definiéndolas por fuera. Si el archivo no existe, la
// configuración avisa qué falta al arrancar.
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env: se usa solo el entorno del proceso.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await configurarApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
