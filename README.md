# 💰 Finance Family - Gestión de Finanzas Familiares

Aplicación web para gestionar las finanzas familiares de Yosba y Yane, con soporte para múltiples cuentas bancarias, tarjetas de crédito/débito, análisis financiero y gestión de patrimonio.

## 🚀 Características

### ✅ Implementadas

- **Autenticación con Google**: Login seguro mediante Firebase Authentication
- **Dashboard Financiero**: KPIs en tiempo real (balance, ingresos, gastos, ahorro, deuda)
- **Gestión de Cuentas**: 15 cuentas predefinidas (BROU, Itaú, Santander, OCA, Prex, BHU, IBM)
- **Carga de Extractos**:
  - Soporte para PDF, CSV y Excel
  - **🧠 Parsers Inteligentes**: Detección automática de formato por banco uruguayo
  - Parsers específicos para BROU, Itaú, Santander, OCA, Prex y BHU
  - Procesamiento en memoria (sin almacenar archivos)
  - Detección de duplicados por hash SHA-256
  - Auto-categorización inteligente
  - Ver [BANK_PARSERS.md](./BANK_PARSERS.md) para detalles de formatos
- **Gestión de Transacciones**:
  - Lista completa con filtros avanzados
  - Edición y clasificación manual
  - Búsqueda por descripción, cuenta, categoría, fecha
- **Análisis Financiero**:
  - Gráficos de tendencia mensual (ingresos, gastos, ahorro)
  - Distribución de gastos por categoría (pie chart)
  - Distribución de ingresos por categoría (bar chart)
  - Filtros por período (3m, 6m, 12m, todo) y moneda (UYU, USD)
- **Gestión de Patrimonio**:
  - Registro de activos (propiedades, vehículos, inversiones)
  - Valoración en UYU y USD
  - Tracking de fecha de adquisición
- **Objetivos Financieros**:
  - Creación de metas con montos y fechas límite
  - Barra de progreso visual
  - Actualización de avances
  - Estados: activo, completado, cancelado
- **Multi-moneda**: Soporte completo para UYU y USD
- **Multi-usuario**: Datos aislados por usuario (Firebase UID)
- **Diseño Responsive**: Optimizado para desktop y móvil
- **Dark Mode**: Tema oscuro automático

### 📋 Pendientes

- Exportación de reportes (PDF, Excel)
- Notificaciones de objetivos próximos a vencer
- Comparación de períodos (mes actual vs anterior)
- Mejoras en parsers PDF para OCA
- Tests unitarios para parsers de bancos

## 🏗️ Arquitectura

### Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS
- **Gráficos**: Recharts
- **Backend**: Firebase (Authentication + Realtime Database)
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

### Estructura del Proyecto

```
src/
├── components/
│   ├── auth/              # LoginPage, ProtectedRoute
│   ├── common/            # LoadingSpinner, KPICard
│   ├── dashboard/         # Dashboard principal
│   ├── layout/            # Header, Sidebar, Layout
│   ├── transactions/      # UploadStatements, TransactionList
│   ├── reports/           # FinancialAnalysis
│   ├── assets/            # AssetManagement
│   └── goals/             # GoalsManagement
├── hooks/                 # useAuth
├── parsers/               # csvParser, excelParser, pdfParser, fileHasher
├── services/              # Firebase services (auth, accounts, categories, transactions, assets, goals, uploadHistory)
├── types/                 # TypeScript interfaces
└── utils/                 # categorization, calculations
```

## 🔧 Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/yosbany/finance-family-tp.git
cd finance-family-tp
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Firebase

Crear archivo `.env.local` con tus credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_FIREBASE_DATABASE_URL=tu_database_url
```

### 4. Configurar Firebase Realtime Database

Aplicar las reglas de seguridad desde `firebase-rules.json`:

```json
{
  "rules": {
    "accounts": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "transactions": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "categories": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "assets": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "goals": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "uploadHistory": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### 6. Build para producción

```bash
npm run build
```

## 🚀 Deployment en GitHub Pages

### Configuración Inicial

1. **Habilitar GitHub Pages**:
   - Ve a Settings > Pages
   - Source: GitHub Actions

2. **Configurar Secrets**:
   - Ve a Settings > Secrets and variables > Actions
   - Agrega los siguientes secrets:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
     - `VITE_FIREBASE_DATABASE_URL`

3. **Push a main**:
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

El workflow de GitHub Actions se ejecutará automáticamente y desplegará la aplicación.

## 📊 Cuentas Configuradas

### Yosba
- BROU Pesos / Dólares
- Itaú Pesos / Dólares
- Itaú Visa (crédito)
- OCA Master 1 (crédito)
- OCA Visa (crédito)
- Prex Pesos / Dólares
- IBM Inversiones

### Yane
- Santander Pesos / Dólares
- Santander Visa (crédito)
- OCA Master 2 (crédito)

### Ambos
- BHU Conjunto

## 📁 Categorías Predefinidas

### Ingresos
- Salario
- Freelance
- Inversiones
- Otros

### Gastos
- Alimentación (Supermercado, Restaurantes, Delivery)
- Transporte (Combustible, Uber/Taxi, Mantenimiento, Estacionamiento)
- Servicios (Electricidad, Agua, Internet, Teléfono, Cable)
- Vivienda (Alquiler/Hipoteca, Mantenimiento, Contribución, Seguros)
- Salud (Mutualista, Farmacia, Médicos, Seguros)
- Entretenimiento (Streaming, Cine, Eventos, Hobbies)
- Educación (Cursos, Libros, Matrícula)
- Compras (Ropa, Electrónica, Hogar, Otros)
- Otros Gastos

## 🔐 Seguridad

- Autenticación mediante Google OAuth
- Datos aislados por usuario (Firebase UID)
- Reglas de seguridad en Firebase Realtime Database
- Variables de entorno para credenciales sensibles
- No se almacenan archivos (procesamiento en memoria)

## 📱 Uso de la Aplicación

### 1. Login
- Accede con tu cuenta de Google
- Primera vez: se inicializan cuentas y categorías automáticamente

### 2. Dashboard
- Visualiza KPIs principales
- Balance total en UYU y USD
- Ingresos y gastos del mes
- Tasa de ahorro

### 3. Cargar Extractos
- Ve a "Cargar Extractos"
- Selecciona la cuenta bancaria
- Sube archivo PDF, CSV o Excel
- Las transacciones se categorizan automáticamente
- Se detectan duplicados por hash

### 4. Gestionar Transacciones
- Ve a "Transacciones"
- Filtra por cuenta, categoría, tipo, fecha
- Edita descripciones y categorías
- Elimina transacciones incorrectas

### 5. Análisis Financiero
- Ve a "Reportes"
- Selecciona período y moneda
- Visualiza gráficos de tendencia
- Analiza distribución de gastos e ingresos

### 6. Gestión de Patrimonio
- Ve a "Patrimonio"
- Agrega activos (casa, auto, inversiones)
- Actualiza valores
- Visualiza patrimonio total

### 7. Objetivos Financieros
- Ve a "Objetivos"
- Crea metas con montos y fechas
- Actualiza progreso
- Visualiza barra de avance

## 🤝 Contribuir

Este es un proyecto personal, pero si encuentras bugs o tienes sugerencias:

1. Abre un issue
2. Describe el problema o mejora
3. Si es posible, incluye capturas de pantalla

## 📄 Licencia

MIT License - Uso personal y educativo

## 👨‍💻 Autor

**Yosba** - Gestión de finanzas familiares para Yosba y Yane

---

**Hecho con ❤️ usando React, TypeScript, Firebase y Tailwind CSS**