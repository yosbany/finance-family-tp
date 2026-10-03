# 🚀 Guía Rápida - Finance Family

## ¡Bienvenido! Comienza aquí 👋

### La estructura es muy simple ahora:

```
📁 finance-family/
├── 📂 apps/frontend/          ← Tu código React está aquí 🎨
├── 📂 apps/backend/           ← Tu servidor está aquí 🔧
├── 📂 docs/                   ← Toda la documentación aquí 📚
├── 📂 config/                 ← Configuración (Firebase, etc) ⚙️
├── 📂 scripts/                ← Scripts de test 🧪
└── 📄 README.md               ← Empezar por aquí
```

## ⚡ Los 5 Pasos Básicos

### 1️⃣ Instalar dependencias
```bash
npm install
```

### 2️⃣ Configurar variables de entorno
Crea o edita `.env.local` en la raíz con tu config de Firebase:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
# ... más variables
```

### 3️⃣ Iniciar el servidor de desarrollo
```bash
npm run dev
```
✅ Abre http://localhost:5173 en el navegador

### 4️⃣ Hacer cambios
- **Frontend**: `apps/frontend/src/`
- **Backend**: `apps/backend/server/src/`
- Los cambios se guardan automáticamente (hot reload)

### 5️⃣ Compilar para producción
```bash
npm run build
```

## 🗂️ ¿Dónde está cada cosa?

### 🎨 Frontend (React)
```
apps/frontend/src/
├── components/     ← Componentes React reutilizables
├── pages/          ← Páginas principales de la app
├── App.tsx         ← Componente raíz
└── main.tsx        ← Punto de entrada
```

### 🔧 Backend (Node.js)
```
apps/backend/server/src/
├── app/            ← Configuración Express
├── routes/         ← Rutas de la API
├── agent/          ← Agente IA
├── llm/            ← Cliente del LLM
└── firebase/       ← Configuración Firebase Admin
```

### 📚 Documentación
```
docs/
├── INDEX.md                    ← Índice completo de docs
├── QUICKSTART.md               ← Guía de inicio rápido
├── PLAN.md                     ← Plan general del proyecto
├── FASE_*.md                   ← Reportes de cada fase
├── DEPLOYMENT_STEPS.md         ← Cómo deployar
├── FIREBASE_SETUP.md           ← Setup de Firebase
└── ... (40+ archivos más)
```

### ⚙️ Configuración
```
config/
├── deployment/                 ← Configuración de deploy
├── firebase.json               ← Config Firebase
└── firebase-rules.json         ← Reglas de Firestore
```

## 📖 ¿Necesitas un archivo de docs?

### Si quieres saber...

| Necesito... | Voy a | Leo |
|------------|-------|------|
| Cómo empezar | `docs/` | [QUICKSTART.md](./docs/QUICKSTART.md) |
| Entender el proyecto | `docs/` | [PLAN.md](./docs/PLAN.md) |
| Configurar Firebase | `docs/` | [FIREBASE_SETUP.md](./docs/FIREBASE_SETUP.md) |
| Configurar secretos | `docs/` | [CONFIGURAR_SECRETS.md](./docs/CONFIGURAR_SECRETS.md) |
| Usar el agente IA | `docs/` | [AGENT_API_DEV.md](./docs/AGENT_API_DEV.md) |
| Deployar la app | `docs/` | [DEPLOYMENT_STEPS.md](./docs/DEPLOYMENT_STEPS.md) |
| Deployar en Firebase | `docs/` | [FIREBASE_DEPLOYMENT_GUIDE.md](./docs/FIREBASE_DEPLOYMENT_GUIDE.md) |
| Configurar NGINX/HTTPS | `docs/` | [NGINX_HTTPS_GUIDE.md](./docs/NGINX_HTTPS_GUIDE.md) |
| Ver todo | `docs/` | [INDEX.md](./docs/INDEX.md) |

## 🐛 Troubleshooting

### "No funciona npm run dev"
```bash
# Intenta limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### "Errores de Firebase"
→ Verifica que `.env.local` tiene las variables correctas
→ Lee: [FIREBASE_SETUP.md](./docs/FIREBASE_SETUP.md)

### "No entiendo la estructura"
→ Lee: [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)

### "¿Cómo debo trabajar?"
→ Lee: [PLAN.md](./docs/PLAN.md)

## 💻 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Inicia servidor local

# Producción
npm run build            # Compila para producción
npm run preview          # Previewiza la build

# Validación
npm run lint             # Chequea errores de código
npm run build && npm run preview  # Full build + preview

# Scripts especiales
node scripts/test-*.mjs  # Ejecutar tests específicos
```

## 🔗 Archivos Más Importantes

| Archivo | Para Qué |
|---------|----------|
| [README.md](./README.md) | Descripción del proyecto |
| [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) | Mapa completo del proyecto |
| [GUIA_RAPIDA.md](./GUIA_RAPIDA.md) | Esta guía |
| [docs/INDEX.md](./docs/INDEX.md) | Índice de toda la documentación |
| [package.json](./package.json) | Dependencies y scripts |
| [.env.local](./.env.local) | Variables de entorno (local) |

## 🎯 Flujo Típico de Trabajo

```
1. npm install                    ← Instala dependencias
   ↓
2. npm run dev                    ← Inicia servidor local
   ↓
3. Editas código en apps/frontend/src/ o apps/backend/server/src/
   ↓
4. Hot reload automático ✨
   ↓
5. npm run build                  ← Cuando terminas
   ↓
6. Lees docs/DEPLOYMENT_STEPS.md  ← Para deployar
```

## ❓ Preguntas Frecuentes

### ¿Cómo editar componentes React?
→ Ve a `apps/frontend/src/components/` y edita los archivos `.tsx`

### ¿Dónde están las rutas de la API?
→ Ve a `apps/backend/server/src/routes/`

### ¿Cómo agregar nuevas variables de entorno?
→ Edita `.env.local` y `.env.example`

### ¿Necesito cambiar rutas después de mover carpetas?
→ Ya está hecho. El `package.json` y configs apuntan a las nuevas ubicaciones.

### ¿Puedo ejecutar frontend y backend por separado?
→ Sí, pero necesitarás configuración especial. Lee `docs/AGENT_API_DEV.md`

## 🚀 Próximos Pasos

1. ✅ Lee [README.md](./README.md) para entender la estructura
2. ✅ Ejecuta `npm install` para instalar dependencias
3. ✅ Configura `.env.local` con tus credenciales
4. ✅ Ejecuta `npm run dev` para ver la app funcionando
5. ✅ Lee [docs/PLAN.md](./docs/PLAN.md) para entender qué hay que hacer
6. ✅ Comienza a trabajar en `apps/frontend/src/` o `apps/backend/server/src/`

## 📞 Necesitas Ayuda?

- 📚 Todos los docs están en la carpeta `docs/`
- 🗂️ El índice completo está en `docs/INDEX.md`
- 🏗️ La estructura del proyecto está en `PROJECT_STRUCTURE.md`
- 📖 Explicación de directorios en `README.md`

---

**¡Que disfrutes desarrollando! 🎉**

Versión: 1.0
Fecha: Oct 3, 2026
