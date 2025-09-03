## CI scripts

```
chmod +x /var/www/beeport/ci/deploy.sh
```

so it can be run by webhook

Add a .env file to the ci folder with the following:

```
WEBHOOK_SECRET=your_secret_key
```

Add a webhook to the github repo on settings -> webhooks
