# 🔐 Guía Paso a Paso: Configurar Secrets de Firebase en GitHub

## ⚠️ IMPORTANTE
Sin estos secrets, el deployment NO funcionará. El error `404` que ves es porque el build no se ha ejecutado aún.

## 📋 Pasos Detallados

### Paso 1: Abrir tu archivo .env.local

1. En VS Code, abre el archivo `.env.local` (está en la raíz del proyecto)
2. Verás algo como esto:

```
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:xxxxxxxxxxxxx
VITE_FIREBASE_DATABASE_URL=https://tu-proyecto-default-rtdb.firebaseio.com
```

3. **Deja esta ventana abierta** para copiar los valores

### Paso 2: Ir a GitHub Secrets

1. Abre tu navegador y ve a:
   ```
   https://github.com/yosbany/finance-family-tp/settings/secrets/actions
   ```

2. O navega manualmente:
   - Ve a tu repositorio: https://github.com/yosbany/finance-family-tp
   - Haz clic en **"Settings"** (arriba a la derecha)
   - En el menú lateral izquierdo, busca **"Secrets and variables"**
   - Haz clic en **"Actions"**

### Paso 3: Agregar los 7 Secrets

Vas a crear 7 secrets. Para cada uno:

#### Secret 1: VITE_FIREBASE_API_KEY

1. Haz clic en el botón verde **"New repository secret"**
2. En **"Name"**, escribe exactamente: `VITE_FIREBASE_API_KEY`
3. En **"Secret"**, copia el valor de tu `.env.local` (solo el valor después del `=`, sin comillas)
   - Ejemplo: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
4. Haz clic en **"Add secret"**

#### Secret 2: VITE_FIREBASE_AUTH_DOMAIN

1. Haz clic en **"New repository secret"** nuevamente
2. **Name**: `VITE_FIREBASE_AUTH_DOMAIN`
3. **Secret**: Copia el valor de `VITE_FIREBASE_AUTH_DOMAIN` de tu `.env.local`
   - Ejemplo: `tu-proyecto.firebaseapp.com`
4. Haz clic en **"Add secret"**

#### Secret 3: VITE_FIREBASE_PROJECT_ID

1. **Name**: `VITE_FIREBASE_PROJECT_ID`
2. **Secret**: Copia el valor de `VITE_FIREBASE_PROJECT_ID`
   - Ejemplo: `tu-proyecto`
3. Haz clic en **"Add secret"**

#### Secret 4: VITE_FIREBASE_STORAGE_BUCKET

1. **Name**: `VITE_FIREBASE_STORAGE_BUCKET`
2. **Secret**: Copia el valor de `VITE_FIREBASE_STORAGE_BUCKET`
   - Ejemplo: `tu-proyecto.appspot.com`
3. Haz clic en **"Add secret"**

#### Secret 5: VITE_FIREBASE_MESSAGING_SENDER_ID

1. **Name**: `VITE_FIREBASE_MESSAGING_SENDER_ID`
2. **Secret**: Copia el valor de `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - Ejemplo: `123456789012`
3. Haz clic en **"Add secret"**

#### Secret 6: VITE_FIREBASE_APP_ID

1. **Name**: `VITE_FIREBASE_APP_ID`
2. **Secret**: Copia el valor de `VITE_FIREBASE_APP_ID`
   - Ejemplo: `1:123456789012:web:xxxxxxxxxxxxx`
3. Haz clic en **"Add secret"**

#### Secret 7: VITE_FIREBASE_DATABASE_URL

1. **Name**: `VITE_FIREBASE_DATABASE_URL`
2. **Secret**: Copia el valor de `VITE_FIREBASE_DATABASE_URL`
   - Ejemplo: `https://tu-proyecto-default-rtdb.firebaseio.com`
3. Haz clic en **"Add secret"**

### Paso 4: Verificar que todos los secrets estén creados

Deberías ver 7 secrets en la lista:
- ✅ VITE_FIREBASE_API_KEY
- ✅ VITE_FIREBASE_AUTH_DOMAIN
- ✅ VITE_FIREBASE_PROJECT_ID
- ✅ VITE_FIREBASE_STORAGE_BUCKET
- ✅ VITE_FIREBASE_MESSAGING_SENDER_ID
- ✅ VITE_FIREBASE_APP_ID
- ✅ VITE_FIREBASE_DATABASE_URL

### Paso 5: Configurar GitHub Pages

1. Ve a: https://github.com/yosbany/finance-family-tp/settings/pages
2. En **"Build and deployment"**:
   - **Source**: Selecciona **"GitHub Actions"**
3. No necesitas guardar nada, se configura automáticamente

### Paso 6: Ejecutar el Workflow

1. Ve a: https://github.com/yosbany/finance-family-tp/actions
2. Si ves un mensaje para habilitar workflows:
   - Haz clic en **"I understand my workflows, go ahead and enable them"**
3. Haz clic en **"Deploy to GitHub Pages"** (en el menú lateral izquierdo)
4. Haz clic en el botón **"Run workflow"** (arriba a la derecha)
5. Selecciona la rama **"main"**
6. Haz clic en el botón verde **"Run workflow"**

### Paso 7: Esperar el Deployment (2-3 minutos)

1. Verás el workflow ejecutándose con un círculo amarillo 🟡
2. Espera a que aparezca un check verde ✅
3. Si aparece una X roja ❌:
   - Haz clic en el workflow fallido
   - Revisa los logs para ver qué secret está mal configurado
   - Corrige el secret y vuelve a ejecutar el workflow

### Paso 8: Configurar Firebase (IMPORTANTE)

Para que el login funcione:

1. Ve a: https://console.firebase.google.com
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Settings** (pestaña superior)
4. Busca **"Authorized domains"**
5. Haz clic en **"Add domain"**
6. Escribe: `yosbany.github.io`
7. Haz clic en **"Add"**

### Paso 9: ¡Acceder a tu Aplicación! 🎉

Una vez que el workflow termine con ✅:

```
https://yosbany.github.io/finance-family-tp/
```

## ⚠️ Errores Comunes

### Error: "Required secret not provided"
**Causa**: Falta algún secret o el nombre está mal escrito
**Solución**: Verifica que los 7 secrets estén creados con los nombres exactos

### Error: "Firebase: Error (auth/invalid-api-key)"
**Causa**: El valor del secret `VITE_FIREBASE_API_KEY` es incorrecto
**Solución**: Verifica que copiaste el valor correcto de tu `.env.local`

### Error: "Firebase: Error (auth/unauthorized-domain)"
**Causa**: El dominio no está autorizado en Firebase
**Solución**: Agrega `yosbany.github.io` a los dominios autorizados en Firebase Console

### La página muestra "404"
**Causa**: El workflow aún no se ha ejecutado o falló
**Solución**: Ve a Actions y verifica el estado del workflow

## 📝 Checklist Final

Antes de intentar acceder a la app, verifica:

- [ ] Los 7 secrets están configurados en GitHub
- [ ] GitHub Pages está configurado para usar "GitHub Actions"
- [ ] El workflow se ejecutó y terminó con ✅
- [ ] El dominio `yosbany.github.io` está autorizado en Firebase
- [ ] Esperaste al menos 2-3 minutos después de que el workflow terminó

## 🆘 ¿Necesitas Ayuda?

Si después de seguir todos los pasos aún tienes problemas:

1. Ve a: https://github.com/yosbany/finance-family-tp/actions
2. Haz clic en el último workflow ejecutado
3. Revisa los logs para ver el error específico
4. Busca el error en Google o pregúntame

---

**Tiempo estimado**: 10 minutos

¡Éxito! 🚀