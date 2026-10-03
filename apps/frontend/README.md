# 🎨 Frontend - Finance Family

Aplicación React moderna para gestión de finanzas familiares.

## 📋 Estructura

```
frontend/
├── src/
│   ├── components/         # Componentes React reutilizables
│   ├── pages/             # Páginas/rutas principales
│   ├── App.tsx            # Componente raíz
│   ├── main.tsx           # Punto de entrada
│   └── ...
├── public/                # Recursos estáticos (imágenes, etc)
├── index.html             # HTML principal
├── vite.config.ts         # Configuración de Vite
├── tsconfig.json          # Configuración de TypeScript
└── package.json           # Scripts y dependencias
```

## 🚀 Comandos

Desde la raíz del proyecto ejecuta:

```bash
# Desarrollo (hot reload)
npm run dev

# Compilación para producción
npm run build

# Preview de la build
npm run preview

# Linting
npm run lint
```

O desde dentro de `apps/frontend`:

```bash
cd apps/frontend
npm run dev      # requiere dependencias en raíz
```

## 🎯 Características

- ✅ React 18 con TypeScript
- ✅ Routing con React Router
- ✅ Autenticación Firebase
- ✅ Firestore para almacenamiento
- ✅ UI moderno con Tailwind CSS
- ✅ Gráficos con Recharts
- ✅ Soporte para PDF (pdf.js)
- ✅ Parse de CSV con Papa Parse
- ✅ Hojas de cálculo con XLSX

## 📦 Dependencias Principales

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.22.0",
  "firebase": "^10.8.0",
  "recharts": "^2.15.4",
  "typescript": "^5.3.3",
  "vite": "^5.1.0"
}
```

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env.local` en la raíz (nivel de package.json):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### Configuración de Vite

Ver `vite.config.ts` para opciones de build y dev server.

### Estilos

- **Framework**: Tailwind CSS
- **Config**: `tailwind.config.js`
- **PostCSS**: `postcss.config.js`

## 📂 Componentes Importantes

- `AgentQueryDev` - Componente para consultas de agent (desarrollo)
- Otros componentes ubicados en `src/components/`

## 🎯 Desarrollo

1. Los cambios en `src/` se reflejan automáticamente con hot reload
2. Los errores de TypeScript aparecen en la terminal
3. Revisa los errores del ESLint antes de hacer commit

## 📖 Ver También

- [Documentación General](../../README.md)
- [Backend](../backend/README.md)
- [Documentación Técnica](../../docs/TECHNICAL_VALIDATION.md)

---

**Stack**: React + TypeScript + Vite + Firebase
