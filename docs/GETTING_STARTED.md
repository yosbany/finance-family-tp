# 🚀 Guía de Inicio Rápido

## Prerrequisitos

- Node.js 18+ instalado
- Cuenta de Google
- Proyecto de Firebase creado

## 📦 Instalación

### 1. Clonar el repositorio (si aplica)

```bash
git clone https://github.com/tu-usuario/finance-family-tp.git
cd finance-family-tp
```

### 2. Instalar dependencias

```bash
npm install
```

Esto instalará todas las dependencias necesarias:
- React 18
- TypeScript
- Firebase
- Tailwind CSS
- React Router
- Recharts
- Papa Parse (CSV)
- XLSX (Excel)
- PDF.js

## 🔥 Configurar Firebase

### Paso 1: Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto llamado `finance-family-tp`
3. Habilita Google Analytics (opcional)

### Paso 2: Habilitar Authentication

1. En el menú lateral, ve a **Authentication**
2. Haz clic en "Comenzar"
3. Habilita el proveedor **Google**
4. Configura el correo de soporte

### Paso 3: Crear Realtime Database

1. En el menú lateral, ve a **Realtime Database**
2. Haz clic en "Crear base de datos"
3. Selecciona la ubicación más cercana
4. Inicia en modo de prueba (cambiaremos las reglas después)

### Paso 4: Configurar Reglas de Seguridad

1. En Realtime Database, ve a la pestaña **Reglas**
2. Copia el contenido de `firebase-rules.json`
3. Pégalo en el editor de reglas
4. Haz clic en "Publicar"

### Paso 5: Obtener Credenciales

Las credenciales ya están configuradas en `.env.local`:

```env
VITE_FIREBASE_API_KEY=AIzaSyDGVuRT0-QiZXEBDK0j9Acf3-AWXAhiflE
VITE_FIREBASE_AUTH_DOMAIN=finance-family-tp.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://finance-family-tp-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=finance-family-tp
VITE_FIREBASE_STORAGE_BUCKET=finance-family-tp.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=947949418993
VITE_FIREBASE_APP_ID=1:947949418993:web:46bbeaec29e3364a21ac50
```

### Paso 6: Autorizar Dominio

1. En **Authentication** > **Settings** > **Authorized domains**
2. Agrega:
   - `localhost` (ya está por defecto)
   - `tu-usuario.github.io` (para GitHub Pages)

## 🏃 Ejecutar el Proyecto

### Modo Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en: http://localhost:5173

### Compilar para Producción

```bash
npm run build
```

Los archivos compilados estarán en la carpeta `dist/`

### Vista Previa de Producción

```bash
npm run preview
```

## 🧪 Probar la Aplicación

### 1. Iniciar Sesión

1. Abre http://localhost:5173
2. Haz clic en "Iniciar sesión con Google"
3. Selecciona tu cuenta de Google
4. Autoriza la aplicación

### 2. Explorar el Dashboard

Al iniciar sesión por primera vez:
- Se crearán automáticamente 15 cuentas bancarias predefinidas
- Se crearán 10 categorías con subcategorías
- Verás el dashboard con KPIs en cero (aún no hay transacciones)

### 3. Ver las Cuentas

- Haz clic en "Cuentas" en el menú lateral
- Verás todas tus cuentas bancarias y tarjetas
- Incluye: BROU, Itaú, Santander, OCA, Prex, BHU, IBM

### 4. Cargar un Extracto (Próximamente)

La funcionalidad de carga de extractos está implementada en el backend pero falta la interfaz:
- Soporta archivos PDF, CSV y Excel
- Calcula hash SHA-256 para detectar duplicados
- Categoriza automáticamente las transacciones

## 📁 Estructura del Proyecto

```
finance-family-tp/
├── src/
│   ├── components/          # Componentes React
│   │   ├── auth/           # Login y rutas protegidas
│   │   ├── dashboard/      # Dashboard y KPIs
│   │   ├── layout/         # Header, Sidebar, Layout
│   │   └── common/         # Componentes reutilizables
│   ├── services/           # Servicios de Firebase
│   │   ├── firebase.ts
│   │   ├── auth.service.ts
│   │   ├── accounts.service.ts
│   │   ├── categories.service.ts
│   │   └── uploadHistory.service.ts
│   ├── parsers/            # Parsers de archivos
│   │   ├── csvParser.ts
│   │   ├── excelParser.ts
│   │   ├── pdfParser.ts
│   │   └── fileHasher.ts
│   ├── utils/              # Utilidades
│   │   ├── categorization.ts
│   │   └── calculations.ts
│   ├── hooks/              # Custom hooks
│   │   └── useAuth.ts
│   ├── types/              # Tipos TypeScript
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── .env.local              # Variables de entorno (NO subir a Git)
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 🎨 Características Implementadas

### ✅ Completadas

1. **Autenticación con Google**
   - Login seguro
   - Gestión de sesión
   - Rutas protegidas

2. **Dashboard**
   - 6 KPIs principales
   - Resumen de cuentas
   - Acciones rápidas

3. **Sistema de Cuentas**
   - 15 cuentas predefinidas
   - Soporte para débito, crédito e inversiones
   - Multi-moneda (UYU y USD)

4. **Sistema de Categorización**
   - 10 categorías con subcategorías
   - Categorización automática por keywords
   - Aprendizaje de clasificaciones manuales

5. **Parsers de Archivos**
   - Soporte para PDF, CSV y Excel
   - Hash SHA-256 para detectar duplicados
   - Los archivos NO se almacenan

6. **Cálculos Financieros**
   - Balance total
   - Ingresos y gastos
   - Ahorro mensual
   - Patrimonio neto
   - Tendencias mensuales

### 🚧 En Desarrollo

- Interfaz de carga de extractos
- Clasificación manual de transacciones
- Gráficos interactivos
- Gestión de patrimonio
- Objetivos financieros
- Reportes detallados

## 🐛 Solución de Problemas

### Error: "Firebase App not initialized"

**Solución**: Verifica que `.env.local` existe y tiene las credenciales correctas.

### Error: "Permission denied"

**Solución**: 
1. Verifica que las reglas de seguridad estén configuradas en Firebase
2. Asegúrate de estar autenticado

### Error: "Module not found"

**Solución**: 
```bash
rm -rf node_modules package-lock.json
npm install
```

### La página está en blanco

**Solución**:
1. Abre la consola del navegador (F12)
2. Revisa los errores
3. Verifica que Firebase esté configurado correctamente

## 📊 Datos de Prueba

Al iniciar sesión por primera vez, se crean automáticamente:

### Cuentas (15)
- BROU: Pesos y Dólares (Yosba)
- Itaú: Pesos, Dólares y Visa (Yosba)
- Santander: Pesos, Dólares y Visa (Yane)
- OCA: 3 tarjetas (Yosba y Yane)
- Prex: Pesos y Dólares (Yosba)
- BHU: Cuenta conjunta
- IBM: Inversiones (Yosba)

### Categorías (10)
- Ingresos
- Alimentación
- Transporte
- Servicios
- Vivienda
- Salud
- Entretenimiento
- Educación
- Compras
- Otros Gastos

## 🚀 Deployment en GitHub Pages

### Configuración Inicial

1. Crea un repositorio en GitHub
2. Sube el código:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/finance-family-tp.git
git push -u origin main
```

### Habilitar GitHub Pages

1. Ve a Settings > Pages
2. Source: GitHub Actions
3. El workflow en `.github/workflows/deploy.yml` se ejecutará automáticamente

### Agregar Secrets

1. Ve a Settings > Secrets and variables > Actions
2. Agrega los secrets de Firebase:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### Deploy Manual

```bash
npm run deploy
```

## 📚 Recursos Adicionales

- [Documentación de React](https://react.dev/)
- [Documentación de Firebase](https://firebase.google.com/docs)
- [Documentación de Tailwind CSS](https://tailwindcss.com/docs)
- [Documentación de Vite](https://vitejs.dev/)

## 🤝 Soporte

Si encuentras algún problema:
1. Revisa la consola del navegador
2. Verifica la configuración de Firebase
3. Consulta `FIREBASE_SETUP.md` para más detalles
4. Revisa `PROGRESS.md` para ver el estado del proyecto

---

**¡Listo para comenzar!** 🎉

Ejecuta `npm run dev` y abre http://localhost:5173