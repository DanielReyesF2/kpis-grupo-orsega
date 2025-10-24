#!/bin/bash
# Script para inicializar la base de datos y migrar los datos

echo "Configurando la base de datos..."

# Paso 1: Inicializar las tablas
echo "Paso 1: Inicializando tablas en la base de datos..."
node scripts/init-db.js

# Paso 2: Migrar los datos
echo "Paso 2: Migrando datos a la base de datos..."
node scripts/migrate-data.js

echo "Configuración de la base de datos completada."