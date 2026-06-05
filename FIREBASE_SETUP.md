# 🔥 Configuración de Firebase

## Paso 1: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Agregar proyecto"
3. Nombre del proyecto: `finance-family-tp` (o el que prefieras)
4. Desactiva Google Analytics (opcional)
5. Haz clic en "Crear proyecto"

## Paso 2: Configurar Authentication

1. En el menú lateral, ve a **Authentication**
2. Haz clic en "Comenzar"
3. En la pestaña "Sign-in method", habilita **Google**
4. Configura el correo de soporte del proyecto
5. Guarda los cambios

## Paso 3: Crear Realtime Database

1. En el menú lateral, ve a **Realtime Database**
2. Haz clic en "Crear base de datos"
3. Selecciona la ubicación más cercana (ej: `us-central1`)
4. Selecciona "Comenzar en modo de prueba" (lo cambiaremos después)
5. Haz clic en "Habilitar"

## Paso 4: Configurar Reglas de Seguridad

1. En Realtime Database, ve a la pestaña **Reglas**
2. Copia y pega el contenido del archivo `firebase-rules.json`
3. Haz clic en "Publicar"

Las reglas aseguran que:
- Cada usuario solo puede leer/escribir sus propios datos
- Los datos están protegidos por autenticación

## Paso 5: Obtener Credenciales

1. Ve a **Configuración del proyecto** (ícono de engranaje)
2. En la sección "Tus apps", haz clic en el ícono web `</>`
3. Registra la app con el nombre: `finance-family-tp`
4. NO marques "Firebase Hosting"
5. Copia las credenciales que aparecen

## Paso 6: Configurar Variables de Entorno

1. Crea un archivo `.env.local` en la raíz del proyecto:

```bash
cp .env.example .env.local
```

2. Edita `.env.local` con tus credenciales:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=finance-family-tp.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://finance-family-tp-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=finance-family-tp
VITE_FIREBASE_STORAGE_BUCKET=finance-family-tp.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Paso 7: Configurar Dominio Autorizado

1. En **Authentication** > **Settings** > **Authorized domains**
2. Agrega tu dominio de GitHub Pages:
   - `tu-usuario.github.io`
3. Guarda los cambios

## Paso 8: Configurar GitHub Secrets (para CI/CD)

Si usas GitHub Actions para deployment automático:

1. Ve a tu repositorio en GitHub
2. Settings > Secrets and variables > Actions
3. Agrega los siguientes secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

## Verificación

Para verificar que todo está configurado correctamente:

```bash
# Iniciar servidor de desarrollo
npm run dev
```

1. Abre http://localhost:5173
2. Intenta iniciar sesión con Google
3. Verifica que puedes autenticarte correctamente

## Estructura de Datos en Firebase

Una vez que inicies sesión, Firebase creará automáticamente esta estructura:

```
finance-family-tp-default-rtdb/
├── users/
│   └── {userId}/
├── accounts/
│   └── {userId}/
├── transactions/
│   └── {userId}/
├── uploadHistory/
│   └── {userId}/
├── categories/
│   └── {userId}/
├── assets/
│   └── {userId}/
├── goals/
│   └── {userId}/
└── rules/
    └── {userId}/
```

## Solución de Problemas

### Error: "Firebase: Error (auth/unauthorized-domain)"

**Solución**: Agrega tu dominio a los dominios autorizados en Firebase Console.

### Error: "Permission denied"

**Solución**: Verifica que las reglas de seguridad estén correctamente configuradas.

### Error: "Firebase App not initialized"

**Solución**: Verifica que las variables de entorno estén correctamente configuradas en `.env.local`.

## Monitoreo

Puedes monitorear el uso de Firebase en:
- **Authentication** > **Users**: Ver usuarios registrados
- **Realtime Database** > **Data**: Ver datos en tiempo real
- **Realtime Database** > **Usage**: Ver estadísticas de uso

## Límites del Plan Gratuito (Spark)

- **Authentication**: 10,000 verificaciones/mes
- **Realtime Database**: 
  - 1 GB almacenamiento
  - 10 GB/mes descarga
  - 100 conexiones simultáneas

Para uso familiar, estos límites son más que suficientes.

## Backup

Es recomendable hacer backups periódicos:

1. Ve a **Realtime Database** > **Data**
2. Haz clic en los tres puntos > **Export JSON**
3. Guarda el archivo en un lugar seguro

## Seguridad Adicional

1. **Habilitar App Check** (opcional pero recomendado)
2. **Configurar alertas** en Cloud Monitoring
3. **Revisar logs** regularmente en Authentication y Database

---

¿Necesitas ayuda? Consulta la [documentación oficial de Firebase](https://firebase.google.com/docs).