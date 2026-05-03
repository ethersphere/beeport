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

# Install dependencies and build the static export. nginx serves the
# resulting files directly from /var/www/beeport/out — there is no app
# server to (re)start, the browser talks straight to the Bee node.
log_message "Installing dependencies"
npm ci
log_message "Building application"
npm run build

log_message "Deployment completed"