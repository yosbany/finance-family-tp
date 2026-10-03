# 🗂️ Estructura del Proyecto Finance Family

## Vista General

```
finance-family/
│
├── 🎨 apps/
│   ├── frontend/                    # 🖥️ Aplicación React
│   │   ├── src/
│   │   │   ├── components/          # Componentes React reutilizables
│   │   │   ├── pages/              # Páginas principales
│   │   │   ├── App.tsx             # App principal
│   │   │   └── main.tsx            # Punto de entrada
│   │   ├── public/                 # Assets estáticos
│   │   ├── index.html              # HTML principal
│   │   ├── vite.config.ts          # Config Vite
│   │   ├── tsconfig.json           # Config TypeScript
│   │   ├── tailwind.config.js      # Config Tailwind
│   │   ├── postcss.config.js       # Config PostCSS
│   │   ├── package.json            # Dependencies
│   │   └── README.md               # Documentación frontend
│   │
│   └── backend/                    # 🔧 Servidor Node.js
│       ├── server/
│       │   ├── src/
│       │   │   ├── app/            # App Express
│       │   │   ├── routes/         # Rutas de API
│       │   │   ├── agent/          # Agente IA
│       │   │   │   ├── orchestrator.ts
│       │   │   │   └── toolRegistry.ts
│       │   │   ├── llm/            # Cliente LLM
│       │   │   │   ├── client.ts
│       │   │   │   └── types.ts
│       │   │   └── firebase/       # Firebase Admin
│       │   ├── tsconfig.json
│       │   └── package.json
│       │
│       ├── functions/              # Firebase Cloud Functions
│       │   ├── src/
│       │   └── ...
│       │
│       └── README.md               # Documentación backend
│
├── 📚 docs/                        # 📖 Toda la documentación
│   ├── INDEX.md                    # Índice de documentación
│   ├── QUICKSTART.md               # Guía rápida
│   ├── GETTING_STARTED.md          # Setup completo
│   ├── PLAN.md                     # Plan general
│   ├── README.md                   # Descripción general
│   │
│   ├── 🔐 Seguridad & Setup
│   │   ├── FIREBASE_SETUP.md
│   │   ├── CONFIGURAR_SECRETS.md
│   │   ├── GIT_SETUP.md
│   │   ├── FASE_02_SEGURIDAD.md
│   │   └── SECURITY_CHECKLIST_FASE_04D.md
│   │
│   ├── 🤖 Agente & API
│   │   ├── AGENT_API_DEV.md
│   │   └── FRONTEND_API_CONFIG.md
│   │
│   ├── 📊 Datos & Parsers
│   │   └── BANK_PARSERS.md
│   │
│   ├── 📈 Fases (Fase 1-5)
│   │   ├── FASE_01_RESUMEN.md
│   │   ├── FASE_02_SEGURIDAD.md
│   │   ├── PLAN-FASE03.md
│   │   ├── FASE_03B_REPORT.md
│   │   ├── FASE_04_REPORTE.md
│   │   ├── DEPLOYMENT_READY.md
│   │   ├── FASE_05_IMPLEMENTATION.md
│   │   └── ... (más reportes de fases)
│   │
│   └── 🚀 Deployment
│       ├── DEPLOYMENT_STEPS.md
│       ├── FIREBASE_DEPLOYMENT_GUIDE.md
│       └── NGINX_HTTPS_GUIDE.md
│
├── ⚙️ config/                      # 🔧 Configuración
│   ├── deployment/                 # Configuración de deploy
│   │   ├── nginx.conf
│   │   ├── docker-compose.yml
│   │   └── ...
│   ├── firebase.json               # Config Firebase
│   └── firebase-rules.json         # Reglas Firestore
│
├── 🧪 scripts/                     # 🔬 Scripts de utilidad
│   ├── test-*.mjs                  # Tests varios
│   ├── validate-*.mjs              # Validaciones
│   ├── test-specs/                 # Test specifications
│   └── ... (scripts de testing)
│
├── 🗂️ extraxtos/                   # 📁 Archivos diversos
│   └── ...
│
├── 📦 node_modules/                # Dependencias (no tocar)
│
├── 🌐 .github/                     # GitHub Actions & config
│
├── 📝 Archivos raíz
│   ├── README.md                   # 👈 EMPEZAR AQUÍ
│   ├── PROJECT_STRUCTURE.md        # Este archivo
│   ├── package.json                # Dependencies raíz
│   ├── package-lock.json           # Lock file
│   ├── .env.local                  # Variables locales
│   ├── .env.production             # Variables producción
│   ├── .env.example                # Ejemplo de variables
│   ├── vite.config.ts              # (Vite - raíz)
│   ├── .gitignore                  # Git ignore
│   └── .git/                       # Repositorio Git
```

## 📍 Dónde Encontrar Qué

### 🚀 Quiero empezar
→ Lee `README.md` en la raíz
→ Luego `docs/QUICKSTART.md`

### 🎨 Quiero trabajar en el frontend
→ Ve a `apps/frontend/`
→ Lee `apps/frontend/README.md`
→ El código está en `apps/frontend/src/`

### 🔧 Quiero trabajar en el backend
→ Ve a `apps/backend/server/`
→ Lee `apps/backend/README.md`
→ El código está en `apps/backend/server/src/`

### 📚 Quiero leer documentación
→ Ve a `docs/`
→ Lee `docs/INDEX.md` para ver todos los documentos
→ O busca lo que necesitas en el índice

### 🚀 Quiero deployar
→ Lee `docs/DEPLOYMENT_STEPS.md`
→ Luego `docs/FIREBASE_DEPLOYMENT_GUIDE.md`
→ Configuración en `config/deployment/`

### 🔐 Tengo dudas de seguridad
→ Lee `docs/FASE_02_SEGURIDAD.md`
→ Y `docs/SECURITY_CHECKLIST_FASE_04D.md`

### 🧪 Quiero ejecutar tests
→ Ve a `scripts/`
→ Ve qué archivos test hay disponibles
→ Ejecútalos desde `npm run` o directamente

## 🔑 Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `README.md` | Descripción general y navegación |
| `PROJECT_STRUCTURE.md` | Este archivo - mapa del proyecto |
| `package.json` | Dependencies y scripts |
| `.env.local` | Variables de entorno (local) |
| `docs/INDEX.md` | Índice completo de documentación |
| `docs/QUICKSTART.md` | Guía rápida para empezar |
| `apps/frontend/src/` | Código React |
| `apps/backend/server/src/` | Código Node.js |

## 🎯 Flujo de Trabajo Típico

```
1. Clonas/abres el proyecto
   ↓
2. Lees README.md para entender la estructura
   ↓
3. Lees docs/QUICKSTART.md para setup
   ↓
4. Ejecutas: npm install
   ↓
5. Configuras variables de entorno (.env.local)
   ↓
6. Ejecutas: npm run dev
   ↓
7. Trabajas en:
   - Frontend: apps/frontend/src/
   - Backend: apps/backend/server/src/
   ↓
8. Antes de deployar, lees docs/DEPLOYMENT_STEPS.md
```

## 📊 Estadísticas del Proyecto

- **Documentos**: 40+ archivos en `docs/`
- **Líneas de código**: Esparcidas entre frontend y backend
- **Dependencias**: 30+ paquetes npm
- **Configuración**: Firebase, TypeScript, Vite, Tailwind

## 🔗 Enlaces Rápidos

- [Documentación General](./README.md)
- [Índice de Docs](./docs/INDEX.md)
- [Quick Start](./docs/QUICKSTART.md)
- [Frontend](./apps/frontend/README.md)
- [Backend](./apps/backend/README.md)

---

**Versión**: 0.1.0
**Fecha**: Oct 3, 2026
**Estado**: Reorganizado y documentado
