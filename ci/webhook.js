const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SECRET = process.env.WEBHOOK_SECRET;
const PORT = 9001;
const APP_PATH = '/var/www/multichain';
const LOG_PATH = path.join(APP_PATH, '/ci/webhook-logs.txt');

// Create a simple logging function
const log = message => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(LOG_PATH, logMessage);
};

http
  .createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      log('Received webhook request');

      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        const signature = req.headers['x-hub-signature'];

        // Verify the signature
        const hmac = crypto.createHmac('sha1', SECRET);
        const digest = 'sha1=' + hmac.update(body).digest('hex');

        if (signature === digest) {
          try {
            const payload = JSON.parse(body);

            // Check if it's a push to the main branch
            if (payload.ref === 'refs/heads/main') {
              log('Push to main branch detected, deploying...');

              // Execute deployment script
              const deployCommand = `${APP_PATH}/ci/deploy.sh`;

              exec(deployCommand, (error, stdout, stderr) => {
                if (error) {
                  log(`Deployment error: ${error.message}`);
                  return;
                }
                if (stdout) log(`Deployment stdout: ${stdout}`);
                if (stderr) log(`Deployment stderr: ${stderr}`);
                log('Deployment command completed');
              });
            } else {
              log(`Push to ${payload.ref} detected, ignoring`);
            }
          } catch (err) {
            log(`Error processing webhook: ${err.message}`);
          }

          res.statusCode = 200;
          res.end('Webhook received');
        } else {
          log('Invalid signature received');
          res.statusCode = 403;
          res.end('Invalid signature');
        }
      });
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  })
  .listen(PORT, () => {
    log(`Webhook server listening on port ${PORT}`);
  });
