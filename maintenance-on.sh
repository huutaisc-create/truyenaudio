#!/bin/bash
# Bật maintenance mode
cd /var/www/truyenaudio
echo "MAINTENANCE_MODE=true" > .env.production.local
git pull && npm run build && pm2 restart truyenaudio
echo "✅ Maintenance mode: BẬT"
