# share-site: Multi-tenant Static Site Hosting

Deploy static sites to Cloudflare Pages with one command. Users don't need their own Cloudflare account.

## Architecture

```
User runs: share-site ./my-folder
                ↓
         Zips folder, POSTs to Worker
                ↓
    ┌───────────────────────────┐
    │  Your Cloudflare Worker   │
    │  (share-site-api)         │
    └───────────────────────────┘
                ↓
         Deploys via CF API
                ↓
    ┌───────────────────────────┐
    │  Cloudflare Pages         │
    │  site-xxxxx.pages.dev     │
    └───────────────────────────┘
```

## Setup (One-time, ~5 minutes)

### 1. Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Configure permissions:
   - **Account** → Cloudflare Pages → Edit
   - **Account** → Access: Apps and Policies → Edit
5. Account Resources: Include → Your Account
6. Create token and **copy it**

### 2. Get Your Account ID

1. Go to: https://dash.cloudflare.com/
2. Click on any domain (or Workers & Pages)
3. Copy your Account ID from the right sidebar

### 3. Deploy the Worker

```bash
cd share-site-worker

# Install wrangler if needed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy

# Set your secrets
wrangler secret put CF_API_TOKEN
# Paste your API token when prompted

wrangler secret put CF_ACCOUNT_ID
# Paste your account ID when prompted
```

### 4. Note Your Worker URL

After deploying, you'll see something like:
```
Published share-site-api (https://share-site-api.bob.workers.dev)
```

### 5. Configure the CLI

Edit `share-site` and replace `YOUR-SUBDOMAIN`:

```bash
WORKER_URL="${SHARE_SITE_API:-https://share-site-api.bob.workers.dev}"
```

Or users can set an environment variable:
```bash
export SHARE_SITE_API=https://share-site-api.bob.workers.dev
```

### 6. Distribute the CLI

Give users the `share-site` script. They just need `curl` and `zip` (pre-installed on most systems).

```bash
# Install for a user
chmod +x share-site
sudo mv share-site /usr/local/bin/

# Or just run from anywhere
./share-site ./my-folder
```

---

## Usage

```bash
# Deploy current folder (public)
share-site

# Deploy specific folder
share-site ./my-site

# With a name
share-site ./my-site --name my-project

# Password protection (quick, JS-based)
share-site ./my-site -p secret123

# Email-based access (proper auth via Cloudflare Access)
share-site ./my-site -e "alice@gmail.com,bob@company.com"

# Allow entire domain
share-site ./my-site -d "@techleap.nl"

# Combine
share-site ./my-site -e "external@gmail.com" -d "@techleap.nl"
```

---

## Security Notes

### For You (the operator)

- Your API token is stored securely in Cloudflare Worker secrets
- Users never see your token
- You can revoke the token anytime to disable all deployments
- All sites deploy to your Cloudflare account

### For Users

- `--password`: Quick but visible in page source. Good for casual sharing.
- `--emails` / `--domain`: Proper authentication via Cloudflare Access. Visitors must verify their email.

### Rate Limiting (Optional)

Add rate limiting to the worker to prevent abuse:

```javascript
// Add to worker - limit deployments per IP
const ip = request.headers.get('CF-Connecting-IP');
// Implement rate limiting with Cloudflare KV or Durable Objects
```

---

## Costs

- **Cloudflare Workers**: Free tier = 100,000 requests/day
- **Cloudflare Pages**: Free tier = unlimited sites, 500 builds/month
- **Cloudflare Access**: Free tier = 50 users

For a small team, this is effectively **$0/month**.

---

## Customization Ideas

### Custom Domain

Point a domain to the worker:
```
deploy.yourcompany.com → share-site-api.workers.dev
```

### Allowed Users List

Add an allowlist to the worker to restrict who can deploy:

```javascript
const ALLOWED_EMAILS = ['alice@company.com', 'bob@company.com'];
const userEmail = request.headers.get('X-User-Email');
if (!ALLOWED_EMAILS.includes(userEmail)) {
  return new Response('Unauthorized', { status: 403 });
}
```

### Slack Notifications

Post to Slack when someone deploys:

```javascript
await fetch(SLACK_WEBHOOK, {
  method: 'POST',
  body: JSON.stringify({ text: `New site deployed: ${url}` })
});
```
