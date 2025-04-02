#!/bin/bash
# /var/www/multichain/deploy.sh

# Log function
log_message() {
  echo "[$(date -Iseconds)] $1" >> /var/www/multichain/deploy-log.txt
}

log_message "Starting deployment"

# Navigate to app directory
cd /var/www/multichain
log_message "Pulling latest changes"
git pull

# Install dependencies and build
log_message "Installing dependencies"
npm ci
log_message "Building application"
npm run build

# Restart the application
log_message "Stopping existing screen session"
screen -S multichain -X quit > /dev/null 2>&1 || true
log_message "Starting new screen session"
screen -dmS multichain bash -c "cd /var/www/multichain/backend && node index.js > backend.log 2>&1"

# Check if screen session was created
if screen -list | grep -q "multichain"; then
  log_message "Screen session 'multichain' started successfully"
else
  log_message "ERROR: Failed to start screen session 'multichain'"
fi

log_message "Deployment completed"