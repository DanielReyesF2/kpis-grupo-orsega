// Este script inicializa las tablas en la base de datos
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Inicializando base de datos...');

try {
  // Ejecutar comando para crear las tablas
  console.log('Creando tablas en la base de datos...');
  const pushOutput = execSync('npx drizzle-kit push:pg --verbose').toString();
  console.log(pushOutput);

  console.log('Inicialización de la base de datos completa.');
} catch (error) {
  console.error('Error al inicializar la base de datos:', error.message);
  console.error('Comando fallido:', error.cmd);
  if (error.stdout) console.log('Stdout:', error.stdout.toString());
  if (error.stderr) console.log('Stderr:', error.stderr.toString());
}