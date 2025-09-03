#!/bin/bash
# /var/www/beeport/deploy.sh

# Log function
log_message() {
  echo "[$(date -Iseconds)] $1" >> /var/www/beeport/deploy-log.txt
}

log_message "Starting deployment"

# Navigate to app directory
cd /var/www/beeport
log_message "Pulling latest changes"
git pull

# Install dependencies and build
log_message "Installing dependencies"
npm ci
log_message "Building application"
npm run build

# Restart the application
log_message "Stopping existing screen session"
screen -S beeport -X quit > /dev/null 2>&1 || true
log_message "Starting new screen session"
screen -dmS beeport bash -c "cd /var/www/beeport/backend && node index.js > backend.log 2>&1"

# Check if screen session was created
if screen -list | grep -q "beeport"; then
  log_message "Screen session 'beeport' started successfully"
else
  log_message "ERROR: Failed to start screen session 'beeport'"
fi

log_message "Deployment completed"