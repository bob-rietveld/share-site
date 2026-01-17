# share-site

Deploy static sites to Cloudflare Pages with one command. No Cloudflare account needed.

## Quick Start

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/bob-rietveld/share-site/main/install.sh | bash
source ~/.zshrc

# Register (one account per computer)
share-site register myusername

# Deploy
share-site ./my-folder
```

## Features

- **One command deploy** - No config files, no build steps
- **Multi-user** - Each user gets their own projects
- **One account per computer** - Simple, no credentials to manage
- **Password protection** - AES-256-GCM encrypted pages
- **Email access control** - Cloudflare Access integration
- **API key fallback** - For CI/CD and automation

## Usage

```bash
# Deploy current directory
share-site

# Deploy specific folder
share-site ./my-site

# With custom project name
share-site ./my-site -n my-project

# Password protected (AES-256-GCM encryption)
share-site ./my-site -p secret123

# Email-based access (Cloudflare Access)
share-site ./my-site -e "alice@gmail.com,bob@company.com"

# Allow entire email domain
share-site ./my-site -d "@company.com"

# List your projects
share-site -l

# Delete a project
share-site -D -n my-project

# Check who you're logged in as
share-site me
```

## Authentication

share-site uses **hybrid authentication**:

1. **Machine ID** (primary) - Your computer is automatically recognized after registration
2. **API key** (fallback) - For CI/CD pipelines or when machine ID isn't available

### Normal Use (Your Computer)

After running `share-site register`, your computer is linked to your account. No API key needed for daily use.

### CI/CD or Automation

Set the `SHARE_SITE_KEY` environment variable:

```bash
export SHARE_SITE_KEY=sk_your_api_key_here
share-site ./dist
```

## How It Works

```
share-site ./my-folder
        |
        v
  +-----------------+
  |  CLI packages   |
  |  files as JSON  |
  +-----------------+
        |
        v
  +-----------------+
  |  Cloudflare     |
  |  Worker API     |
  +-----------------+
        |
        v
  +-----------------+
  |  Cloudflare     |
  |  Pages          |
  +-----------------+
        |
        v
  https://user-project.pages.dev
```

## Security

### Password Protection

Uses AES-256-GCM encryption with PBKDF2 key derivation (100k iterations). The password is never sent to the server - encryption happens server-side before deployment, decryption happens client-side in the browser.

### Email Access Control

Uses Cloudflare Access for proper authentication:
- `-e "email@example.com"` - Allow specific emails
- `-d "@company.com"` - Allow entire domain

Visitors verify via email code before accessing the site.

### One Account Per Computer

Each machine can only have one account, tied to the hardware ID. This prevents credential sharing and simplifies authentication.

## Operator Setup

To run your own share-site infrastructure:

### 1. Create Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with permissions:
   - **Account** > Cloudflare Pages > Edit
   - **Account** > Access: Apps and Policies > Edit

### 2. Create KV Namespace

```bash
npx wrangler kv namespace create USERS
```

### 3. Configure wrangler.toml

```toml
name = "share-site-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "USERS"
id = "your-namespace-id"
```

### 4. Set Secrets

```bash
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put CF_ACCOUNT_ID
```

### 5. Deploy

```bash
npx wrangler deploy
```

### 6. (Optional) Require Registration Code

To restrict who can register:

```bash
npx wrangler secret put REGISTRATION_CODE
```

Users must then set `SHARE_SITE_REGISTRATION_CODE` or enter it during registration.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SHARE_SITE_API` | Worker URL (set during install) |
| `SHARE_SITE_KEY` | API key for CI/CD (optional for normal use) |
| `SHARE_SITE_REGISTRATION_CODE` | Registration code if required |

## Costs

- **Cloudflare Workers**: Free tier = 100k requests/day
- **Cloudflare Pages**: Free tier = unlimited sites, 500 builds/month
- **Cloudflare Access**: Free tier = 50 users
- **Cloudflare KV**: Free tier = 100k reads/day, 1k writes/day

Effectively **$0/month** for small teams.

## License

MIT
