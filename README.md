# 💰 Finance Family - Estructura del Proyecto

## 📁 Estructura General

```
finance-family/
├── apps/                    # Código fuente
│   ├── frontend/           # 🎨 Aplicación React
│   └── backend/            # 🔧 Servidores y funciones
├── docs/                   # 📚 Documentación completa
├── config/                 # ⚙️ Configuración y deployment
├── scripts/                # 🧪 Scripts de test y validación
├── node_modules/           # 📦 Dependencias (no tocar)
└── package.json            # 📋 Configuración del proyecto
```

## 🚀 Inicio Rápido

### Desarrollo del Frontend
```bash
npm run dev
```

### Compilación
```bash
npm run build
```

### Validación de código
```bash
npm run lint
```

## 📂 Descripción de Carpetas

### `/apps/frontend` 🎨
Aplicación React con:
- `src/` - Código fuente React
- `public/` - Recursos estáticos
- `index.html` - Punto de entrada HTML
- `vite.config.ts` - Configuración de Vite

### `/apps/backend` 🔧
Servidores y funciones:
- `server/` - Servidor Node.js/Express
- `functions/` - Firebase Cloud Functions

### `/docs` 📚
Toda la documentación del proyecto:
- Guías de setup
- Planes de implementación
- Reportes de fases
- Guías de deployment
- Documentación técnica

### `/config` ⚙️
Configuración y deployment:
- `deployment/` - Configuración de despliegue
- `firebase.json` - Configuración de Firebase
- `firebase-rules.json` - Reglas de Firestore

### `/scripts` 🧪
Scripts de utilidad:
- Tests de validación
- Scripts de verificación
- Archivos de configuración de testing

## 🔗 Enlaces Útiles

### Documentación Importante
- 📖 [README Principal](./README_ORIGINAL.md)
- 🚀 [Quick Start](./docs/QUICKSTART.md)
- 🔒 [Seguridad - Fase 02](./docs/FASE_02_SEGURIDAD.md)
- 🔧 [Configuración Técnica](./docs/TECHNICAL_VALIDATION.md)
- 📋 [Plan General](./docs/PLAN.md)

## 🛠️ Tecnologías

**Frontend:**
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Firebase SDK
- Recharts (gráficos)
- PDF.js (manejo de PDFs)

**Backend:**
- Node.js
- Firebase (Auth, Firestore, Storage)
- Express.js

## 📝 Notas Importantes

1. **Paths en scripts**: Si ejecutas scripts desde la raíz, asegúrate de ajustar las rutas
2. **Entorno**: Usa `.env.local` para variables locales y `.env.production` para producción
3. **Git**: El directorio `.git` está en la raíz del proyecto

## 💡 ¿Necesitas Ayuda?

Consulta los archivos de documentación en `/docs` para guías específicas sobre:
- Setup inicial de Firebase
- Deployment en diferentes ambientes
- Seguridad y validaciones
- Configuración de NGINX/HTTPS
- Estructura de datos

---

**Última actualización**: Oct 3, 2026
**Versión**: 0.1.0
