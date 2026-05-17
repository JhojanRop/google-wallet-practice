# Google Wallet Passes — NestJS

API REST para crear y gestionar pases de Google Wallet. Implementa el flujo B1 (pre-created objects), lo que permite actualizar la información del pase en tiempo real después de que el usuario lo haya guardado.

---

## Requisitos previos

### 1. Cuenta de Issuer en Google Wallet

1. Ve a [pay.google.com/business/console](https://pay.google.com/business/console)
2. Crea tu cuenta de Issuer — te asigna un **Issuer ID** (número largo tipo `1234567890123456789`)
3. Completa el perfil de empresa
4. Las cuentas nuevas inician en **modo demo** — solo puedes emitir pases a cuentas de prueba. Para producción debes solicitar *publishing access*

### 2. Proyecto en Google Cloud

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo
3. Habilita la **Google Wallet API** (también llamada *Google Pay for Passes API*)
4. Ve a **IAM & Admin → Service Accounts** y crea una Service Account
5. En la pestaña **Claves**, genera una clave de tipo JSON y descárgala — este archivo es tu llave de acceso

### 3. Vincular la Service Account al Issuer

1. Vuelve al panel de Google Wallet → **Usuarios**
2. Agrega el `client_email` del JSON descargado con rol **Desarrollador**

---

## Instalación

```bash
npm install
```

### Dependencias clave

```bash
npm install google-auth-library jsonwebtoken @nestjs/config
npm install -D @types/jsonwebtoken
```

---

## Configuración

Crea un archivo `.env` en la raíz:

```env
GOOGLE_WALLET_ISSUER_ID=tu_issuer_id
GOOGLE_WALLET_CLASS_SUFFIX=mi_pase_v1
GOOGLE_APPLICATION_CREDENTIALS=./secrets/wallet-service-account.json
```

Crea la carpeta `secrets/` y mueve ahí el JSON descargado de Google Cloud.

> ⚠️ Agrega `secrets/` al `.gitignore`. Nunca subas este archivo al repositorio.

---

## Conceptos clave

### Pass Class vs Pass Object

| Concepto | Descripción |
|---|---|
| **Pass Class** | Plantilla compartida. Se crea una sola vez. Define el estilo y estructura base del pase |
| **Pass Object** | Instancia individual por usuario. Referencia a una Class y contiene los datos específicos del usuario |

### Flujo B1 (Pre-created Object)

```
Crear Pass Class (una vez)
        ↓
Crear Pass Object por usuario
        ↓
Firmar JWT con el objectId
        ↓
Entregar link "Add to Google Wallet" al usuario
        ↓
Actualizar Pass Object cuando haya cambios
→ el pase se sincroniza automáticamente en el dispositivo del usuario
```

### JWT de emisión

Para entregar el pase al usuario se firma un JWT con la `private_key` de la Service Account. El payload tiene esta estructura:

```json
{
  "iss": "client_email de la service account",
  "aud": "google",
  "origins": ["https://tudominio.com"],
  "typ": "savetowallet",
  "payload": {
    "genericObjects": [{ "id": "ISSUER_ID.user_USERID" }]
  }
}
```

El link final es: `https://pay.google.com/gp/v/save/{JWT}`

---

## Endpoints

### `POST /wallet/class`
Crea la Pass Class (plantilla). Ejecutar una sola vez al hacer setup.

Si la clase ya existe, la retorna sin crear duplicado.

---

### `POST /wallet/pass`
Crea un Pass Object para un usuario.

**Body:**
```json
{
  "userId": "u001",
  "holderName": "Juan Pérez",
  "eventName": "DevFest Medellín 2026",
  "eventDate": "2026-10-15T18:00:00Z",
  "seat": "A-12"
}
```

**Respuesta:** el objeto creado en Google Wallet.

---

### `GET /wallet/pass/:userId/link`
Genera el link "Add to Google Wallet" para un usuario.

**Respuesta:** `https://pay.google.com/gp/v/save/{JWT}`

El usuario abre este link en el navegador y puede guardar el pase en su wallet.

---

### `PATCH /wallet/pass`
Actualiza los datos de un pase existente. El cambio se refleja automáticamente en el dispositivo del usuario sin que tenga que hacer nada.

**Body:** (todos los campos son opcionales excepto `userId`)
```json
{
  "userId": "u001",
  "seat": "B-07",
  "eventName": "Nuevo nombre del evento",
  "state": "INACTIVE"
}
```

Estados válidos: `ACTIVE`, `INACTIVE`, `EXPIRED`

---

### `PATCH /wallet/pass/:userId/expire`
Marca el pase como expirado.

---

## Estructura del proyecto

```
src/
└── wallet/
    ├── wallet.module.ts
    ├── wallet.service.ts      ← lógica de Google Wallet API
    ├── wallet.controller.ts   ← endpoints HTTP
    └── dto/
        ├── create-pass.dto.ts
        └── update-pass.dto.ts
secrets/
└── wallet-service-account.json   ← NO subir al repo
```

---

## IDs en Google Wallet

Todos los IDs siguen el formato `ISSUER_ID.SUFFIX`:

| Recurso | Formato | Ejemplo |
|---|---|---|
| Pass Class | `ISSUER_ID.CLASS_SUFFIX` | `1234567890123456789.mi_pase_v1` |
| Pass Object | `ISSUER_ID.user_USERID` | `1234567890123456789.user_u001` |

---

## Modo demo vs Producción

En **modo demo** los pases muestran la etiqueta `[SOLO PARA PRUEBAS]` y solo pueden ser guardados por cuentas configuradas como cuentas de prueba en el panel.

Para pasar a producción: Google Pay & Wallet Console → **Solicitar acceso para publicar**. El proceso toma 1-2 días hábiles.

---

## Referencias

- [Google Wallet API Docs](https://developers.google.com/wallet/generic)
- [REST API Reference](https://developers.google.com/wallet/generic/rest)
- [Google Pay & Wallet Console](https://pay.google.com/business/console)
- [Google Cloud Console](https://console.cloud.google.com)