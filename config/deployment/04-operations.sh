#!/bin/bash

# Finance Family API - Operations Script
# Common management tasks

usage() {
  cat << EOF
Finance Family API - Operations

Usage: $0 <command>

Commands:
  status          Show service status
  logs            Follow real-time logs
  logs-last N     Show last N log lines (default: 50)
  restart         Restart the service
  stop            Stop the service
  start           Start the service
  enable          Enable auto-start
  disable         Disable auto-start
  config          Show current configuration (safe fields only)
  verify          Verify Firebase credentials
  health          Test health endpoint
  healthext       Test health endpoint (external)
  process         Show process info
  ports           Show port bindings
  nginx-test      Test Nginx configuration
  nginx-reload    Reload Nginx
  backup          Backup current deployment
  restore         Restore from backup

Examples:
  $0 status
  $0 logs
  $0 logs-last 100
  $0 restart
  $0 health

EOF
  exit 1
}

if [ $# -lt 1 ]; then
  usage
fi

COMMAND="$1"

case "$COMMAND" in
  status)
    echo "📊 Service Status"
    echo "=================="
    sudo systemctl status finance-family-api --no-pager
    ;;

  logs)
    echo "📋 Following logs (Ctrl+C to stop)..."
    sudo journalctl -u finance-family-api -f
    ;;

  logs-last)
    LINES="${2:-50}"
    echo "📋 Last $LINES log lines:"
    sudo journalctl -u finance-family-api -n "$LINES" --no-pager
    ;;

  restart)
    echo "🔄 Restarting service..."
    sudo systemctl restart finance-family-api
    sleep 2
    sudo systemctl status finance-family-api --no-pager
    ;;

  stop)
    echo "🛑 Stopping service..."
    sudo systemctl stop finance-family-api
    sleep 1
    sudo systemctl status finance-family-api --no-pager
    ;;

  start)
    echo "▶️  Starting service..."
    sudo systemctl start finance-family-api
    sleep 2
    sudo systemctl status finance-family-api --no-pager
    ;;

  enable)
    echo "✅ Enabling auto-start..."
    sudo systemctl enable finance-family-api
    echo "Auto-start enabled"
    ;;

  disable)
    echo "⏹️  Disabling auto-start..."
    sudo systemctl disable finance-family-api
    echo "Auto-start disabled"
    ;;

  config)
    echo "⚙️  Configuration (SAFE FIELDS ONLY)"
    echo "===================================="
    echo ""
    if [ -f /etc/finance-family-api/finance-family-api.env ]; then
      sudo grep -v "KEY\|SECRET\|CREDENTIALS" /etc/finance-family-api/finance-family-api.env
    else
      echo "❌ Config file not found"
    fi
    ;;

  verify)
    echo "🔍 Verifying Firebase..."
    if [ -f /tmp/03-verify-firebase.sh ]; then
      bash /tmp/03-verify-firebase.sh
    else
      echo "Run on VPS: sudo bash /tmp/03-verify-firebase.sh"
    fi
    ;;

  health)
    echo "💚 Testing health (internal)..."
    RESULT=$(curl -s -w "\nHTTP_%{http_code}" http://127.0.0.1:8030/health 2>&1)
    BODY=$(echo "$RESULT" | head -n-1)
    CODE=$(echo "$RESULT" | tail -n1 | sed 's/HTTP_//')
    
    echo "Response: $BODY"
    echo "Status: HTTP $CODE"
    
    if [ "$CODE" = "200" ]; then
      echo "✅ Health check passed"
    else
      echo "❌ Health check failed"
    fi
    ;;

  healthext)
    URL="${2:-https://service.nrdonline.site}"
    echo "💚 Testing health (external): $URL"
    RESULT=$(curl -s -w "\nHTTP_%{http_code}" "$URL/health" 2>&1)
    BODY=$(echo "$RESULT" | head -n-1)
    CODE=$(echo "$RESULT" | tail -n1 | sed 's/HTTP_//')
    
    echo "Response: $BODY"
    echo "Status: HTTP $CODE"
    
    if [ "$CODE" = "200" ]; then
      echo "✅ Health check passed"
    else
      echo "❌ Health check failed"
    fi
    ;;

  process)
    echo "⚙️  Process Information"
    ps aux | grep -E "node.*dist/server.js|finance-api" | grep -v grep
    ;;

  ports)
    echo "🔌 Port Bindings"
    sudo netstat -tlnp 2>/dev/null | grep -E "LISTEN.*:8030|:80|:443" || \
      sudo ss -tlnp 2>/dev/null | grep -E "LISTEN.*:8030|:80|:443"
    ;;

  nginx-test)
    echo "✔️  Testing Nginx configuration..."
    sudo nginx -t
    ;;

  nginx-reload)
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    sleep 1
    echo "✅ Nginx reloaded"
    ;;

  backup)
    BACKUP_DIR="/backups"
    BACKUP_FILE="$BACKUP_DIR/finance-family-api-$(date +%Y-%m-%d-%H%M%S).tar.gz"
    echo "💾 Creating backup..."
    echo "   Target: $BACKUP_FILE"
    
    if [ ! -d "$BACKUP_DIR" ]; then
      echo "Creating backup directory..."
      sudo mkdir -p "$BACKUP_DIR"
    fi
    
    sudo tar -czf "$BACKUP_FILE" \
      /opt/finance-family-api/ \
      /etc/finance-family-api/finance-family-api.env \
      2>/dev/null || true
    
    if [ -f "$BACKUP_FILE" ]; then
      SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
      echo "✅ Backup created: $BACKUP_FILE ($SIZE)"
      
      # Keep only last 7 backups
      ls -t "$BACKUP_DIR"/finance-family-api-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm
    else
      echo "❌ Backup failed"
    fi
    ;;

  restore)
    BACKUP="${2:-}"
    if [ -z "$BACKUP" ]; then
      echo "Available backups:"
      ls -lh /backups/finance-family-api-*.tar.gz 2>/dev/null || echo "No backups found"
      echo ""
      echo "Usage: $0 restore <backup_file>"
      exit 1
    fi
    
    if [ ! -f "$BACKUP" ]; then
      echo "❌ Backup not found: $BACKUP"
      exit 1
    fi
    
    echo "⚠️  WARNING: This will restore from backup"
    echo "Backup: $BACKUP"
    echo "Press Ctrl+C to cancel, or wait 5 seconds..."
    sleep 5
    
    echo "🔄 Stopping service..."
    sudo systemctl stop finance-family-api
    
    echo "📦 Restoring files..."
    sudo tar -xzf "$BACKUP" -C / 2>/dev/null || true
    
    echo "▶️  Starting service..."
    sudo systemctl start finance-family-api
    
    sleep 2
    sudo systemctl status finance-family-api --no-pager
    echo "✅ Restore complete"
    ;;

  *)
    echo "❌ Unknown command: $COMMAND"
    usage
    ;;
esac
