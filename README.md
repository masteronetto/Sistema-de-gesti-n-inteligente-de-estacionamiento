# SGE-Duoc

Sistema de gestión inteligente de estacionamientos para Duoc UC Sede Maipú.

## Descripción

Esta aplicación simula la gestión operativa de un estacionamiento con dos perfiles principales:

- Guardia
- Jefe de seguridad / administración

Permite visualizar espacios, alertas por bloqueo, sesiones activas y actividad reciente.

## Stack

- React
- TypeScript
- Vite
- Supabase
- Motion
- Lucide React

## Desarrollo local

```bash
npm install
npm run dev
```

La app se ejecuta en `http://localhost:3000`.

## Build

```bash
npm run build
```

## Base de datos en Supabase

El archivo principal de esquema y seed es:

- [supabase_schema.sql](supabase_schema.sql)

Este script crea la estructura base y también carga datos de prueba para:

- `auth.users`
- `public.profiles`
- `public.parking_spaces`
- `public.parking_sessions`
- `public.parking_alerts`
- `public.parking_activity_log`

## Variables de entorno

Para que el login funcione de forma real en Vercel o local, define estas variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puedes copiar el archivo [`.env.example`](.env.example) y usarlo como base para tu archivo `.env` local o para cargar las variables en Vercel.

## Flujo de prueba del login real

1. Crea o confirma los usuarios en Supabase Auth con estos correos:
	- `guardia@duocuc.cl`
	- `jefe_seguridad@duocuc.cl`
	- `servicios_generales@duocuc.cl`
2. Verifica que esos usuarios tengan un registro asociado en `public.profiles`.
3. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en local o en Vercel.
4. Inicia la app y prueba el acceso con:
	- `guardia@duocuc.cl` / `duocguard1`
	- `jefe_seguridad@duocuc.cl` / `duocadmin1`
	- `servicios_generales@duocuc.cl` / `duocadmin1`
5. Si el login falla, revisa que el perfil exista y que el correo de Auth coincida con el de `profiles`.

## Usuarios de prueba

- `guardia@duocuc.cl` / `duocguard1`
- `jefe_seguridad@duocuc.cl` / `duocadmin1`
- `servicios_generales@duocuc.cl` / `duocadmin1`

## Notas

- El seed está pensado para una base de datos vacía.
- Si vuelves a ejecutar el script, los datos de prueba se vuelven a sincronizar.
- La lógica de la app está orientada a validación funcional y pruebas en Vercel.
