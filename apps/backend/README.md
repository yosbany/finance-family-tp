# 🔧 Backend - Finance Family

Servidor y funciones backend para Finance Family.

## 📋 Estructura

```
backend/
├── server/
│   ├── src/
│   │   ├── app/           # Configuración Express
│   │   ├── routes/        # Rutas de API
│   │   ├── agent/         # Agente IA (orchestrator, registry)
│   │   ├── llm/          # Cliente LLM
│   │   ├── firebase/     # Configuración Firebase Admin
│   │   └── ...
│   ├── tsconfig.json
│   ├── package.json
│   └── ...
├── functions/
│   ├── src/              # Firebase Cloud Functions
│   └── ...
└── README.md
```

## 🚀 Setup Inicial

### 1. Dependencias
```bash
npm install
```

### 2. Variables de Entorno
Crea `.env.local` en la raíz del proyecto:

```env
# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# LLM API
ANTHROPIC_API_KEY=your_api_key

# Puerto del servidor
PORT=3000
```

### 3. Credenciales de Firebase
Coloca el archivo JSON de credenciales en la raíz:
- `nrd-db-firebase-adminsdk-fbsvc-72fa84a31a.json`

## 📡 API Endpoints

### Agent Routes (`/api/agent`)
```
POST /api/agent/query      - Enviar query al agente
POST /api/agent/stream     - Stream de respuesta del agente
GET  /api/agent/status     - Estado del agente
```

Ver `server/src/routes/agent.routes.ts` para detalles completos.

## 🤖 Agente IA

### Componentes

1. **Orchestrator** (`server/src/agent/orchestrator.ts`)
   - Coordina la ejecución del agente
   - Gestiona el flujo de conversación

2. **Tool Registry** (`server/src/agent/toolRegistry.ts`)
   - Registro de herramientas disponibles
   - Mapeo de tool calls

3. **LLM Client** (`server/src/llm/client.ts`)
   - Cliente para llamadas al LLM
   - Manejo de streaming

### Tipos
Ver `server/src/llm/types.ts` para interfaces y tipos TypeScript.

## 🔐 Firebase Admin

Configuración en `server/src/firebase/admin.ts`:
- Autenticación
- Firestore
- Storage

## 🧪 Testing

Scripts de test disponibles:
- `scripts/test-agent-local.mjs` - Test local del agente
- `scripts/test-db.mjs` - Test de base de datos
- Ver `scripts/` para más

## 📚 Documentación Técnica

- [API Dev](../../docs/AGENT_API_DEV.md) - Documentación de desarrollo de API
- [Frontend API Config](../../docs/FRONTEND_API_CONFIG.md) - Configuración desde frontend
- [Technical Validation](../../docs/TECHNICAL_VALIDATION.md) - Validaciones técnicas

## 🛠️ Tecnologías

- **Runtime**: Node.js
- **Framework**: Express.js (potencialmente)
- **Lenguaje**: TypeScript
- **Firebase**: Admin SDK
- **LLM**: Anthropic Claude
- **Base de Datos**: Firestore

## 📋 Configuración de TypeScript

Ver `server/tsconfig.json` para opciones del compilador.

## 🚀 Deployment

Ver documentación en:
- `docs/DEPLOYMENT_STEPS.md`
- `docs/FIREBASE_DEPLOYMENT_GUIDE.md`
- `docs/NGINX_HTTPS_GUIDE.md`

## 🔗 Relacionados

- [Frontend](../frontend/README.md)
- [Documentación General](../../README.md)
- [Configuración Firebase](../../docs/FIREBASE_SETUP.md)

---

**Stack**: Node.js + TypeScript + Firebase + Claude AI
