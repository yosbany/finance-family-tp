# 🔧 Configuración de Git y GitHub

## Repositorio
**URL**: https://github.com/yosbany/finance-family-tp.git

## 📦 Subir el Código a GitHub

### Opción 1: Primera vez (repositorio vacío)

```bash
# 1. Inicializar Git (si no está inicializado)
git init

# 2. Agregar todos los archivos
git add .

# 3. Hacer el primer commit
git commit -m "Initial commit: Finance Family App con Firebase"

# 4. Renombrar la rama a main
git branch -M main

# 5. Agregar el repositorio remoto
git remote add origin https://github.com/yosbany/finance-family-tp.git

# 6. Subir el código
git push -u origin main
```

### Opción 2: Si el repositorio ya existe

```bash
# 1. Clonar el repositorio
git clone https://github.com/yosbany/finance-family-tp.git
cd finance-family-tp

# 2. Copiar todos los archivos del proyecto aquí

# 3. Agregar los cambios
git add .

# 4. Hacer commit
git commit -m "Add complete finance app implementation"

# 5. Subir
git push origin main
```

## 🚀 Configurar GitHub Pages

### Paso 1: Habilitar GitHub Pages

1. Ve a tu repositorio: https://github.com/yosbany/finance-family-tp
2. Haz clic en **Settings**
3. En el menú lateral, haz clic en **Pages**
4. En **Source**, selecciona **GitHub Actions**

### Paso 2: Agregar Secrets de Firebase

Para que el deployment automático funcione, necesitas agregar los secrets:

1. Ve a **Settings** > **Secrets and variables** > **Actions**
2. Haz clic en **New repository secret**
3. Agrega cada uno de estos secrets:

```
VITE_FIREBASE_API_KEY = AIzaSyDGVuRT0-QiZXEBDK0j9Acf3-AWXAhiflE
VITE_FIREBASE_AUTH_DOMAIN = finance-family-tp.firebaseapp.com
VITE_FIREBASE_DATABASE_URL = https://finance-family-tp-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID = finance-family-tp
VITE_FIREBASE_STORAGE_BUCKET = finance-family-tp.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 947949418993
VITE_FIREBASE_APP_ID = 1:947949418993:web:46bbeaec29e3364a21ac50
```

### Paso 3: Autorizar Dominio en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `finance-family-tp`
3. Ve a **Authentication** > **Settings** > **Authorized domains**
4. Agrega: `yosbany.github.io`

### Paso 4: Hacer Push para Activar Deployment

```bash
git push origin main
```

El workflow de GitHub Actions se ejecutará automáticamente y desplegará tu app.

## 📍 URLs del Proyecto

- **Repositorio**: https://github.com/yosbany/finance-family-tp
- **GitHub Pages**: https://yosbany.github.io/finance-family-tp
- **Firebase Console**: https://console.firebase.google.com/project/finance-family-tp

## 🔄 Workflow de Desarrollo

### Hacer cambios y subirlos

```bash
# 1. Ver el estado
git status

# 2. Agregar archivos modificados
git add .

# 3. Hacer commit con mensaje descriptivo
git commit -m "Descripción de los cambios"

# 4. Subir a GitHub
git push origin main
```

### Crear una nueva rama para features

```bash
# 1. Crear y cambiar a nueva rama
git checkout -b feature/nombre-feature

# 2. Hacer cambios y commits
git add .
git commit -m "Add new feature"

# 3. Subir la rama
git push origin feature/nombre-feature

# 4. Crear Pull Request en GitHub
# 5. Después de merge, volver a main
git checkout main
git pull origin main
```

## 📝 Archivos Importantes

### .gitignore
Ya está configurado para ignorar:
- `node_modules/`
- `dist/`
- `.env.local` (¡IMPORTANTE! No subir credenciales)
- Archivos del sistema

### .env.local
**NUNCA** subir este archivo a Git. Las credenciales están en:
- Localmente: `.env.local`
- GitHub Actions: Secrets del repositorio
- Producción: Variables de entorno

## 🔒 Seguridad

### ⚠️ IMPORTANTE: No subir credenciales

El archivo `.env.local` está en `.gitignore` para evitar subir credenciales.

Si accidentalmente subes credenciales:

```bash
# 1. Eliminar del historial
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty --tag-name-filter cat -- --all

# 2. Forzar push
git push origin --force --all

# 3. Regenerar credenciales en Firebase Console
```

## 📊 Verificar Deployment

Después de hacer push:

1. Ve a **Actions** en GitHub
2. Verás el workflow "Deploy to GitHub Pages" ejecutándose
3. Espera a que termine (tarda ~2-3 minutos)
4. Visita: https://yosbany.github.io/finance-family-tp

## 🐛 Solución de Problemas

### Error: "remote: Permission denied"

**Solución**: Configura tu autenticación de GitHub
```bash
# Usar HTTPS con token
git remote set-url origin https://TOKEN@github.com/yosbany/finance-family-tp.git

# O usar SSH
git remote set-url origin git@github.com:yosbany/finance-family-tp.git
```

### Error: "failed to push some refs"

**Solución**: Pull primero
```bash
git pull origin main --rebase
git push origin main
```

### Deployment falla en GitHub Actions

**Solución**: 
1. Verifica que todos los secrets estén configurados
2. Revisa los logs en la pestaña Actions
3. Asegúrate de que el workflow file esté en `.github/workflows/deploy.yml`

## 📚 Comandos Útiles

```bash
# Ver historial de commits
git log --oneline

# Ver diferencias
git diff

# Deshacer cambios no commiteados
git checkout -- archivo.txt

# Ver ramas
git branch -a

# Eliminar rama local
git branch -d nombre-rama

# Actualizar desde remoto
git pull origin main

# Ver remotes configurados
git remote -v
```

## 🎯 Checklist de Deployment

- [ ] Código subido a GitHub
- [ ] GitHub Pages habilitado
- [ ] Secrets de Firebase configurados
- [ ] Dominio autorizado en Firebase
- [ ] Workflow ejecutado exitosamente
- [ ] App accesible en https://yosbany.github.io/finance-family-tp
- [ ] Login con Google funciona
- [ ] Dashboard se muestra correctamente

---

**¡Listo para desplegar!** 🚀

Ejecuta los comandos de la Opción 1 o 2 según tu caso.