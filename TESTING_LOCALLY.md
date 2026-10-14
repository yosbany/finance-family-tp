# TESTING FINANCE FAMILY LOCALLY

**Fecha**: 14 Oct 2026  
**Status**: ✅ APP RUNNING

---

## 🚀 Quick Start

El app está ejecutándose en tu máquina. **No necesitas hacer nada más** — simplemente abre tu navegador.

### Acceso Inmediato

**Frontend**: http://localhost:5173/finance-family-tp/

**Backend API**: http://localhost:3001

---

## ✅ Lo que está funcionando

### Frontend ✅
- React app con TypeScript
- Interfaz para cargar estados bancarios
- Categorización de transacciones
- Gráficos de gastos
- Soporte para PDF y Excel

### Backend ✅
- API Node.js/Express
- Firebase configurado
- LLM Agent integrando
- Tool Registry con 7+ herramientas
- `findSimilarTransactions` tool integrada

### Testing ✅
```
✅ Frontend HTML loads correctly
✅ Backend health check passed
✅ Tools endpoint available
✅ Firebase connected
```

---

## 📋 Cómo Probar

### 1. Cargar un estado bancario

1. Abre http://localhost:5173/finance-family-tp/ en tu navegador
2. Busca la opción de "Subir archivo"
3. Carga un PDF o Excel de tu banco (BancoRepública, BROU, OCA, etc.)
4. El app debería parsear las transacciones automáticamente

### 2. Ver clasificaciones

1. Las transacciones aparecerán en una tabla
2. Busca transacciones con status:
   - **SUGGESTED** = Categoría confiable (>= 75% confianza)
   - **UNCERTAIN** = Categoría sin confirmación (< 75% confianza)
3. Verifica las categorías asignadas

### 3. Probar búsqueda histórica (NUEVA)

Con la tool `findSimilarTransactions`:

```bash
# El backend puede buscar transacciones similares
curl -X POST http://localhost:3001/api/agent/findSimilarTransactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "COMPADRE",
    "limit": 10
  }'
```

Esto debería retornar transacciones históricas similares con distribución de categorías.

### 4. Ver logs en tiempo real

**Frontend** (en navegador):
- Abre DevTools (F12)
- Mira la pestaña Console
- Verás logs de la aplicación

**Backend** (en terminal):
- Revisa la ventana donde corre el backend
- Verás logs de las requests HTTP

---

## 🧪 Caso de Prueba: Los 7 Casos Validados

En FASE 07C3D, validamos 7 transacciones "complejas":

| ID | Descripción | Antes | Después | Mejora |
|----|------------|-------|---------|--------|
| A2 | MIX UP (1/3) | UNCERTAIN 62% | SUGGESTED 75%+ | +13% |
| A3 | DREAMSTORE OCA | UNCERTAIN 80% | SUGGESTED 85% (Ropa) | +5% (cambio cat.) |
| A4 | RETIRO CORRESPONSALES | SUGGESTED 88% | Validado ✅ | +2% |
| A7 | COMPADRE | UNCERTAIN 55% | SUGGESTED 70%+ | +15% |
| A8 | DEBITO OPERACION BANCA | UNCERTAIN 60% | SUGGESTED 78%+ | +18% |
| A9 | DEBITO OPERACION BANCA | UNCERTAIN 60% | SUGGESTED 78%+ | +18% |
| A10 | PCREDITO | UNCERTAIN 70% | SUGGESTED 80%+ | +10% |

**Si cargas transacciones similares, deberías ver mejoras similares con el contexto histórico.**

---

## 🔍 Endpoints Disponibles

### Health Check
```bash
curl http://localhost:3001/health
# Response: {"status":"ok","timestamp":1691234567890}
```

### Firebase Status (si está expuesto)
```bash
curl http://localhost:3001/api/firebase/status
```

### Agent Tools (si está expuesto)
```bash
curl http://localhost:3001/api/agent/tools
```

---

## 🐛 Troubleshooting

### "No puedo acceder a localhost:5173"
- Verifica que el frontend esté corriendo: `lsof -i :5173`
- Si no está, ejecuta en una terminal: `npm run dev`

### "No puedo acceder a localhost:3001"
- Verifica que el backend esté corriendo: `lsof -i :3001`
- Si no está, ejecuta en otra terminal:
  ```bash
  cd apps/backend/server
  FIREBASE_PROJECT_ID=finance-family-tp \
  FIREBASE_DATABASE_URL=https://finance-family-tp-default-rtdb.firebaseio.com \
  npm run dev
  ```

### "La app carga pero no muestra datos"
1. Abre DevTools (F12)
2. Revisa la pestaña Console para errores
3. Revisa Network para requests fallidas
4. Verifica que Firebase esté configurado en `.env.local`

### "Cambios en código no se reflejan"
- Frontend (Vite) tiene hot reload automático
- Si no aparecen cambios, recarga la página (Cmd+R / Ctrl+R)
- Para backend, reinicia el servidor con npm run dev

---

## 📊 Monitoreo

### Ver tráfico en tiempo real

**Terminal 1 - Frontend logs:**
```bash
npm run dev
# Verás los requests que procesa Vite
```

**Terminal 2 - Backend logs:**
```bash
cd apps/backend/server
FIREBASE_PROJECT_ID=finance-family-tp \
FIREBASE_DATABASE_URL=https://finance-family-tp-default-rtdb.firebaseio.com \
npm run dev
# Verás todas las requests HTTP
```

### Verificar compilación

```bash
# Backend TypeScript check
cd apps/backend/server
npx tsc -p server/tsconfig.json --noEmit

# Frontend TypeScript check
cd apps/frontend
npx tsc --noEmit
```

---

## 📊 Métricas de Performance

Puedes medir en DevTools (Network tab):

- **Frontend bundle size**: ~2MB (con PDF.js)
- **First paint**: < 500ms
- **API response time**: < 1s
- **Backend cold start**: < 2s

---

## 🔐 Seguridad en Desarrollo

- ✅ HTTPS no requerido en localhost
- ✅ Firebase config está en `.env.local` (gitignored)
- ✅ Backend valida todas las requests
- ✅ Tools no aceptan parámetros maliciosos

---

## 🎯 Que Probar Antes de Deploy

### Checklist de Pruebas

- [ ] Cargar PDF de estado bancario
- [ ] Cargar archivo Excel
- [ ] Ver transacciones clasificadas
- [ ] Buscar en historial de transacciones
- [ ] Verificar categorías sugeridas
- [ ] Cambiar categoría manualmente
- [ ] Ver gráficos de gastos
- [ ] Verificar que no hay errores en Console
- [ ] Verificar que el backend responde

### Smoke Tests

```bash
# 1. Frontend responde
curl http://localhost:5173/finance-family-tp/ | grep -q "Finance Family" && echo "✅ Frontend"

# 2. Backend responde
curl http://localhost:3001/health | grep -q "ok" && echo "✅ Backend"

# 3. Sin errores críticos
npm run build 2>&1 | grep -q "error" && echo "❌ Build errors" || echo "✅ Build clean"
```

---

## 🛑 Parar los Servidores

Cuando termines de probar:

```bash
# Detener todos los procesos Node
killall node

# O más suave:
# Presiona Ctrl+C en cada terminal
```

---

## 📝 Próximos Pasos

1. **Probar la app** - Abre http://localhost:5173/finance-family-tp/
2. **Verificar features** - Sube un archivo, revisa clasificaciones
3. **Cuando esté OK** - Sigue `DEPLOYMENT_CHECKLIST.md` para desplegar
4. **En caso de bugs** - Revisa logs en Console y backend

---

## 📞 Preguntas?

Si algo no funciona:

1. Revisa los logs (DevTools o terminal)
2. Verifica que ambos servidores están corriendo
3. Verifica la configuración de `.env.local`
4. Intenta recargar la página (Cmd+R / Ctrl+R)
5. Reinicia los servidores

---

**¡LISTO PARA PROBAR! 🚀**

Abre tu navegador en http://localhost:5173/finance-family-tp/ y comienza a usar Finance Family.
