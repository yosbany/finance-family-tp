# 🗺️ Mapa Visual del Proyecto

## Vista de Carpetas

```
📦 finance-family/
│
├─ 📁 apps/                          ← 👈 CÓDIGO FUENTE
│  ├─ 🎨 frontend/
│  │  ├─ src/
│  │  │  ├─ components/              Componentes React
│  │  │  ├─ pages/                   Páginas
│  │  │  ├─ services/                Servicios (API, Auth, etc)
│  │  │  ├─ hooks/                   Custom hooks
│  │  │  ├─ utils/                   Funciones utilitarias
│  │  │  ├─ parsers/                 Parsers bancarios
│  │  │  ├─ types/                   Tipos TypeScript
│  │  │  ├─ App.tsx                  App principal
│  │  │  └─ main.tsx                 Punto de entrada
│  │  ├─ public/                     Assets estáticos
│  │  ├─ index.html                  HTML base
│  │  ├─ vite.config.ts              Config Vite
│  │  ├─ tsconfig.json               Config TypeScript
│  │  ├─ tailwind.config.js          Config Tailwind CSS
│  │  ├─ postcss.config.js           Config PostCSS
│  │  └─ README.md                   📖 Guía del frontend
│  │
│  └─ 🔧 backend/
│     ├─ server/
│     │  ├─ src/
│     │  │  ├─ app/                  Express app
│     │  │  ├─ routes/               Rutas API
│     │  │  ├─ middleware/           Middlewares
│     │  │  ├─ agent/                🤖 Agente IA
│     │  │  │  ├─ orchestrator.ts    Coordinador
│     │  │  │  └─ toolRegistry.ts    Registro de tools
│     │  │  ├─ llm/                  Cliente LLM
│     │  │  ├─ firebase/             Firebase Admin SDK
│     │  │  ├─ auth/                 Autenticación
│     │  │  ├─ finance/              Lógica de finanzas
│     │  │  ├─ config/               Configuración
│     │  │  └─ server.ts             Punto de entrada
│     │  ├─ tsconfig.json
│     │  ├─ package.json
│     │  └─ Dockerfile
│     │
│     ├─ functions/                  Firebase Cloud Functions
│     │  ├─ src/
│     │  │  ├─ agent/
│     │  │  ├─ auth/
│     │  │  ├─ data/
│     │  │  └─ types/
│     │  └─ package.json
│     │
│     └─ README.md                   📖 Guía del backend
│
├─ 📚 docs/                          ← 👈 DOCUMENTACIÓN
│  ├─ INDEX.md                       ⭐ ÍNDICE PRINCIPAL
│  ├─ README.md                      Descripción de docs
│  │
│  ├─ 📖 Inicio Rápido
│  │  ├─ QUICKSTART.md
│  │  ├─ QUICK_REFERENCE.md
│  │  └─ GETTING_STARTED.md
│  │
│  ├─ 🔒 Seguridad & Setup
│  │  ├─ FIREBASE_SETUP.md
│  │  ├─ CONFIGURAR_SECRETS.md
│  │  ├─ GIT_SETUP.md
│  │  ├─ FASE_02_SEGURIDAD.md
│  │  └─ SECURITY_CHECKLIST_FASE_04D.md
│  │
│  ├─ 🤖 Agente & API
│  │  ├─ AGENT_API_DEV.md
│  │  └─ FRONTEND_API_CONFIG.md
│  │
│  ├─ 📊 Datos & Parsers
│  │  ├─ BANK_PARSERS.md
│  │  └─ PLAN.md (arquitectura general)
│  │
│  ├─ 📈 Fases (Desarrollo)
│  │  ├─ FASE_01_RESUMEN.md
│  │  ├─ FASE_02_SEGURIDAD.md
│  │  ├─ PLAN-FASE03.md
│  │  ├─ FASE_03B_REPORT.md
│  │  ├─ FASE_04_REPORTE.md
│  │  ├─ FASE_04D_FINAL_STATUS.md
│  │  ├─ FASE_05_IMPLEMENTATION.md
│  │  └─ ... (más reportes)
│  │
│  ├─ 🚀 Deployment
│  │  ├─ DEPLOYMENT_STEPS.md
│  │  ├─ FIREBASE_DEPLOYMENT_GUIDE.md
│  │  └─ NGINX_HTTPS_GUIDE.md
│  │
│  └─ 📋 Validación & Testing
│     ├─ TECHNICAL_VALIDATION.md
│     └─ PROGRESS.md
│
├─ ⚙️  config/                       ← 👈 CONFIGURACIÓN
│  ├─ deployment/                    Scripts de deploy
│  │  ├─ 00-prepare-local.sh
│  │  ├─ 01-deploy.sh
│  │  ├─ 02-test-deployment.sh
│  │  ├─ 03-verify-firebase.sh
│  │  ├─ 04-operations.sh
│  │  ├─ finance-family-api.service
│  │  ├─ nginx.conf
│  │  ├─ docker-compose.yml
│  │  └─ README.md
│  ├─ firebase.json                  Configuración Firebase
│  └─ firebase-rules.json            Reglas de Firestore
│
├─ 🧪 scripts/                       ← 👈 SCRIPTS & TESTS
│  ├─ test-*.mjs                     Tests varios
│  ├─ validate-*.mjs                 Validaciones
│  ├─ test-specs/                    Especificaciones
│  │  └─ contextDetection.hardening.test.ts
│  └─ README.md                      Guía de scripts
│
├─ 🗂️  extraxtos/                    ← 👈 DATOS AUXILIARES
│  └─ ... (archivos varios)
│
├─ 📦 node_modules/                  ← Dependencias (no editar)
│
├─ 🌐 .github/                       GitHub Actions & config
│
└─ 📝 ARCHIVOS RAÍZ                  ← 👈 INICIO AQUÍ
   ├─ README.md                      ⭐ COMIENZA AQUÍ
   ├─ GUIA_RAPIDA.md                 📖 Instrucciones en español
   ├─ PROJECT_STRUCTURE.md           Estructura del proyecto
   ├─ MAPA_VISUAL.md                 Este archivo
   ├─ package.json                   NPM config
   ├─ package-lock.json              Lock file
   ├─ .env.local                     Variables (local)
   ├─ .env.production                Variables (prod)
   ├─ .env.example                   Template
   ├─ .gitignore                     Git config
   └─ .git/                          Repositorio
```

## 🎯 Navegación por Tarea

### 🚀 Quiero Empezar

```
README.md
    ↓
GUIA_RAPIDA.md
    ↓
docs/QUICKSTART.md
    ↓
npm install && npm run dev
```

### 💻 Quiero Trabajar en Frontend

```
apps/frontend/README.md
    ↓
apps/frontend/src/
    ↓
Edita componentes en: components/, pages/, services/, etc
```

### 🔧 Quiero Trabajar en Backend

```
apps/backend/README.md
    ↓
apps/backend/server/src/
    ↓
Edita en: routes/, agent/, firebase/, etc
```

### 📚 Quiero Leer Documentación

```
docs/INDEX.md
    ↓
Selecciona lo que necesitas de la lista
    ↓
Lee el documento específico
```

### 🚀 Quiero Deployar

```
docs/DEPLOYMENT_STEPS.md
    ↓
docs/FIREBASE_DEPLOYMENT_GUIDE.md (si usas Firebase)
    ↓
config/deployment/
```

### 🔐 Tengo Dudas de Seguridad

```
docs/FASE_02_SEGURIDAD.md
    ↓
docs/SECURITY_CHECKLIST_FASE_04D.md
```

## 📊 Estadísticas

- **Frontend**: ~30 componentes, 15+ servicios, 8 parsers bancarios
- **Backend**: Express.js + Firebase, Agente IA, LLM client
- **Documentación**: 36+ archivos, cobriendo todas las fases
- **Configuración**: Docker, NGINX, Firebase, Deployment
- **Scripts**: 10+ scripts de testing y validación

## 🔑 Archivos Clave

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| **README.md** | Raíz | 👈 Comienza aquí |
| **GUIA_RAPIDA.md** | Raíz | Instrucciones en español |
| **package.json** | Raíz | Scripts npm |
| **INDEX.md** | docs/ | Índice de documentación |
| **vite.config.ts** | apps/frontend/ | Config frontend |
| **server.ts** | apps/backend/server/src/ | Entry point backend |
| **app.ts** | apps/backend/server/src/ | App Express |

## 💡 Consejos de Navegación

1. **Si no sabes dónde ir**: Lee `README.md` en la raíz
2. **Si quieres ir rápido**: Lee `GUIA_RAPIDA.md`
3. **Si necesitas un documento específico**: Consulta `docs/INDEX.md`
4. **Si quieres entender la estructura**: Lee este archivo o `PROJECT_STRUCTURE.md`
5. **Si necesitas ayuda con un componente**: Busca en `apps/frontend/src/` o `apps/backend/server/src/`

## 🔗 Accesos Rápidos

```bash
# Navegar al frontend
cd apps/frontend

# Navegar al backend
cd apps/backend/server

# Ver documentación
cd docs
ls -la

# Ver scripts
cd scripts
ls -la

# Ver configuración
cd config
ls -la
```

## ✨ Lo Que Cambió

**Antes**: Ficheros esparcidos por todas partes 😵
**Ahora**: Todo organizado en carpetas lógicas ✨

```
❌ ANTES                          ✅ AHORA
src/ (suelto)                     apps/frontend/src/
server/ (suelto)                  apps/backend/server/
functions/ (suelto)               apps/backend/functions/
*.md (40+ archivos sueltos)       docs/
deployment/ (suelto)              config/deployment/
test-*.mjs (sueltos)              scripts/
```

## 🎓 Próxima Lectura

- [README.md](./README.md) - Descripción general
- [GUIA_RAPIDA.md](./GUIA_RAPIDA.md) - Inicio rápido
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Estructura detallada
- [docs/INDEX.md](./docs/INDEX.md) - Índice de documentación

---

**¡Bienvenido! Ahora todo tiene sentido. 🚀**
