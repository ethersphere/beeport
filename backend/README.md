## Backend proxy server

This folder contains proxy script to be put on server with BEE Node, serving content and proxying stamps purchases for users.

```
npm install express http-proxy-middleware viem cors dotenv

```

## Config

```
cp .env.example .env
```

and change values of variables in the .env file

## Nginx config example

```nginx
map $http_origin $cors_origin {
    default "";
    "~^https://buzz-mint\.eth\.limo$" "https://buzz-mint.eth.limo";
    "~^https://beeport\.eth\.limo$" "https://beeport.eth.limo";
    "~^https://swarming\.site$" "https://swarming.site";
    "~^https://www\.swarming\.site$" "https://www.swarming.site";
    "~^http://localhost:3000$" "http://localhost:3000";
    "~^https://localhost:3000$" "https://localhost:3000";
    "~^http://127\.0\.0\.1:3000$" "http://127.0.0.1:3000";
    "~^https://127\.0\.0\.1:3000$" "https://127.0.0.1:3000";
}

# Define CORS headers once to avoid duplication
map $request_method $cors_allow_headers {
    default "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,swarm-postage-batch-id,swarm-pin,swarm-deferred-upload,registry-address,swarm-collection,x-upload-signed-message,x-uploader-address,x-file-name,x-message-content,Swarm-Index-Document,Swarm-Error-Document,swarm-tag,x-upload-session-token,x-multi-file-upload";
    OPTIONS "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,swarm-postage-batch-id,swarm-pin,swarm-deferred-upload,registry-address,swarm-collection,x-upload-signed-message,x-uploader-address,x-file-name,x-message-content,Swarm-Index-Document,Swarm-Error-Document,swarm-tag,x-upload-session-token,x-multi-file-upload";
}

map $request_method $cors_expose_headers {
    default "Content-Length,Content-Range,x-session-token,x-session-created,x-session-valid";
    OPTIONS "Content-Length,Content-Range,x-session-token,x-session-created,x-session-valid";
}

map $request_method $cors_allow_methods {
    default "GET, POST, OPTIONS, PUT, DELETE";
    OPTIONS "GET, POST, OPTIONS, PUT, DELETE";
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name swarming.site www.swarming.site;
    return 301 https://$host$request_uri;
}

# Main Server Block (HTTPS)
server {
    listen 443 ssl;
    server_name swarming.site www.swarming.site;

    # SSL Configuration (Managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/swarming.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/swarming.site/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Serve Static Website (Frontend) from beeport/out
    root /var/www/beeport/out/;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    # Proxy API Requests to Backend for /bzz
    location /bzz {
        # Add CORS headers using variables (defined once, used everywhere)
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' $cors_allow_methods always;
        add_header 'Access-Control-Allow-Headers' $cors_allow_headers always;
        add_header 'Access-Control-Expose-Headers' $cors_expose_headers always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle preflight requests (OPTIONS) - uses same variables
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' $cors_allow_methods always;
            add_header 'Access-Control-Allow-Headers' $cors_allow_headers always;
            add_header 'Access-Control-Expose-Headers' $cors_expose_headers always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:3333;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Handle Large Uploads
        client_max_body_size 0;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Proxy /stamps to Bee node
    location /stamps {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle preflight requests (OPTIONS)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:1633;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 0;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Proxy /wallet to Bee node
    location /wallet {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle preflight requests (OPTIONS)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:1633;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 0;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Proxy /tags to Bee node
    location /tags {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,swarm-tag' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle preflight requests (OPTIONS)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,swarm-tag' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:1633;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        client_max_body_size 0;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health check endpoint
    location /health {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle preflight requests (OPTIONS)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass http://localhost:1633;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Benefits of This Configuration

This configuration uses **nginx variables** to eliminate CORS header duplication:

### ✅ **Advantages:**

- **DRY Principle**: Define headers once, use everywhere
- **Easier Maintenance**: Change headers in one place
- **Consistent**: Same headers for preflight and actual requests
- **Cleaner**: Less repetitive code

### 🔧 **How It Works:**

```nginx
# Define once at the top
map $request_method $cors_expose_headers {
    default "Content-Length,Content-Range,x-session-token,x-session-created,x-session-valid";
    OPTIONS "Content-Length,Content-Range,x-session-token,x-session-created,x-session-valid";
}

# Use everywhere
add_header 'Access-Control-Expose-Headers' $cors_expose_headers always;
```

### 📝 **To Add New Headers:**

Just update the map variables at the top - they'll automatically apply to both preflight and actual requests.

## How to Apply This Configuration

### 1. Find your nginx configuration file

Usually located at:

- `/etc/nginx/sites-available/swarming.site`
- `/etc/nginx/nginx.conf`
- `/etc/nginx/conf.d/swarming.site.conf`

### 2. Update your live nginx config

Copy the configuration above to your actual nginx config file, making sure to include:

**Important:** Add this line in TWO places within the `/bzz` location:

```nginx
add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range,x-session-token,x-session-created,x-session-valid' always;
```

**Location 1:** In the main `/bzz` block (after other `add_header` lines)
**Location 2:** Inside the `if ($request_method = 'OPTIONS')` block

### 3. Test and reload nginx

```bash
# Test the configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Troubleshooting CORS Issues

If you're still getting CORS errors, try these debugging steps:

1. **Check if CORS mapping is working:**

   ```bash
   # Test the CORS mapping
   curl -H "Origin: http://localhost:3000" -I https://swarming.site/bzz
   ```

2. **Verify session headers are exposed:**

   ```bash
   # Check if session headers are in the response
   curl -H "Origin: http://localhost:3000" -I https://swarming.site/bzz | grep -i "access-control-expose"
   ```

3. **Add fallback CORS for debugging:**

   ```nginx
   # Temporarily add this to /bzz location for debugging
   add_header 'Access-Control-Allow-Origin' '*' always;
   ```

4. **Check nginx error logs:**

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

5. **Reload nginx after changes:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

# Smart contract registry

We have here smart contract registry, that is used to keep track of stamps bought by user address. Deployed on Gnosis chain with Remix IDE.
