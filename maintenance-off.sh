#!/bin/bash
# Tắt maintenance mode
cd /var/www/truyenaudio
rm -f .env.production.local
git pull && npm run build && pm2 restart truyenaudio
echo "✅ Maintenance mode: TẮT"
