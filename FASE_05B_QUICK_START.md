# ⚡ FASE 05B — Quick Start (Pasos Críticos)

**Status:** ⏳ Bloqueado en verificaciones finales  
**Progreso:** 40% (Backend compilado, necesita deploy)

---

## 🔴 LO QUE NECESITAS HACER AHORA

### Opción 1: Restaurar SSH (2 minutos)
```bash
# Si tienes acceso a panel VPS web:
1. Abre consola VPS web
2. Ejecuta: sudo systemctl restart ssh
3. Luego en tu máquina:
   ssh -i ~/.ssh/id_ed25519 root@service.nrdonline.site
4. Si conecta, verifica clave:
   source /etc/finance-family-api/finance-family-api.env
   echo $NRD_LLM_API_KEY
```

### Opción 2: Proporcionar API Key (1 minuto)
```bash
export NRD_LLM_API_KEY="sk-..."
cd /Users/yosbanytejas/Documents/finance-family/apps/backend/server
node diagnose-llm-setup.mjs
```

---

## ✅ Una Vez Resuelto

```bash
cd /Users/yosbanytejas/Documents/finance-family

# Deploy automático (5-10 minutos):
export NRD_LLM_API_KEY="tu-clave"
./FASE_05B_DEPLOY.sh

# Luego testing (5 minutos):
node apps/backend/server/get-id-token.mjs
# Y ejecutar tests definidos en FASE_05B_EXECUTION_PLAN.md
```

---

## 📄 Documentación

- **FASE_05B_REPORTE_VERIFICACION.md** — Reporte detallado (✅ ¿Qué verificué?)
- **FASE_05B_INSTRUCCIONES_USUARIO.md** — Guía completa (🎯 Qué hacer ahora)
- **FASE_05B_EJECUCION_RESUMEN.txt** — Resumen ejecutivo (📊 Estado actual)
- **diagnose-llm-setup.mjs** — Script de diagnóstico (🔍 Verifica LLM)

---

**Tiempo para completar:** 15-30 minutos una vez resueltos bloqueadores  
**Bloqueador principal:** SSH o API key
