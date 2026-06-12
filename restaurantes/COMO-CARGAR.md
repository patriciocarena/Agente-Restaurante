# Cómo cargar o actualizar un restaurante

Esta guía explica cómo editar los datos de un restaurante y subirlos al sistema con un solo comando. No necesitás saber programar.

---

## 1. Qué es este archivo y dónde está

El archivo `restaurantes/wonder.yaml` tiene todos los datos del restaurante:

- Nombre, dirección y número de WhatsApp
- Horarios de atención por día
- El menú completo con precios

Está en la carpeta principal del proyecto. Para editarlo, abrilo con cualquier editor de texto (Bloc de Notas, TextEdit, VS Code, etc.).

---

## 2. Cómo hacer cambios comunes

### Cambiar un precio

Buscá el item y cambiá el número después de `precio:`:

```yaml
    - nombre: Clásica
      precio: 10500   # <-- cambiaste de 9500 a 10500
```

### Agregar un item nuevo

Agregá un bloque con `nombre` y `precio` dentro de la categoría que corresponde:

```yaml
  Hamburguesas:
    - nombre: BBQ Especial
      precio: 11500
      descripcion: "Carne, panceta, cheddar y salsa BBQ."
```

### Marcar un item como no disponible

Agregá `disponible: false`:

```yaml
    - nombre: Veggie
      precio: 9000
      disponible: false   # <-- no aparece en el menú de la agente
```

Para volver a activarlo, cambiá a `disponible: true` o simplemente borrá esa línea (el default es disponible).

### Agregar una categoría nueva

Agregá una sección nueva al final del menú con el nombre de la categoría seguido de sus items:

```yaml
  Combos:
    - nombre: Combo Clásico
      precio: 14000
      descripcion: "Hamburguesa clásica + papas fritas + bebida."
```

### Cambiar los horarios

Editá la sección `horarios`. Ejemplos:

```yaml
# Un solo horario para todos los días:
horarios:
  todos: "20:00-24:00"

# Horario diferente por día o rango:
horarios:
  lun-mar: "20:00-24:00"
  mie-sab: "20:00-00:30"
  dom: "20:00-24:00"

# Día cerrado:
horarios:
  lun-vie: "20:00-24:00"
  sab: "20:00-01:00"
  dom: cerrado
```

---

## 3. El comando para subir los cambios

Abrí una terminal en la carpeta principal del proyecto y ejecutá:

```bash
pnpm cargar-restaurante restaurantes/wonder.yaml
```

El script va a:
1. Validar el archivo (si hay errores, te los lista todos juntos en español)
2. Actualizar los datos del restaurante en la base de datos
3. Reemplazar los horarios
4. Actualizar el menú (crea o actualiza items; los que sacaste del archivo quedan como "no disponibles")
5. Sincronizar el assistant de voz con el menú nuevo

Al terminar ves un resumen de todo lo que cambió.

---

## 4. Cómo probar sin escribir nada (recomendado antes de cambios grandes)

Agregá `--dry-run` al comando:

```bash
pnpm cargar-restaurante restaurantes/wonder.yaml --dry-run
```

Esto muestra exactamente qué cambiaría, **sin modificar nada** en la base de datos ni en Vapi. Ideal para verificar que editaste el archivo correctamente antes de aplicar.

---

## 5. Qué hacer si falla

Si el comando muestra errores, los vas a ver listados y numerados en español. Por ejemplo:

```
❌ El archivo tiene los siguientes errores:

   1. Falta el campo "nombre" (nombre del restaurante, ej: nombre: wonder).
   2. El "precio" de "Veggie" en "Hamburguesas" debe ser un número entero (ej: 9500), no "9.5".

Corregí los errores y volvé a correr el comando.
```

Corregí cada error en el archivo YAML, guardalo, y volvé a correr el mismo comando. No se escribe nada en la base de datos hasta que el archivo sea válido.

---

## 6. Nota de seguridad importante

El script usa una clave especial (`service role key`) que tiene acceso completo a la base de datos. Por eso:

- **Solo se corre desde la computadora del operador técnico**, nunca desde el servidor (Railway).
- El archivo `.env` con esa clave **nunca se sube al repositorio** (está en `.gitignore`).
- Si alguien más necesita cargar restaurantes, el operador técnico les tiene que dar acceso a esa computadora o correrlo por ellos.

---

*Cualquier duda, contactá al operador técnico del proyecto.*
