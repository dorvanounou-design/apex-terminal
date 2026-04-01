# APEX Micro-Cap Scanner -- Scripts

## GitHub Actions Workflow

The `microcap-scan` workflow runs automatically on weekdays at 2:00 AM UTC
(shortly after US market close). It scans for micro-cap opportunities and
pushes updated data to the repository so the APEX frontend can read it.

## Required Secrets

Configure these in **Settings > Secrets and variables > Actions** in your
GitHub repository:

| Secret              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `FMP_API_KEY`       | Financial Modeling Prep API key (financialmodelingprep.com) |
| `TELEGRAM_BOT_TOKEN`| Telegram bot token from @BotFather                   |
| `TELEGRAM_CHAT_ID`  | Telegram chat/channel ID for notifications           |

### How to obtain each secret

1. **FMP_API_KEY** -- Sign up at https://financialmodelingprep.com and copy
   your API key from the dashboard.
2. **TELEGRAM_BOT_TOKEN** -- Message @BotFather on Telegram, run `/newbot`,
   and copy the token it gives you.
3. **TELEGRAM_CHAT_ID** -- Add your bot to a group or channel, send a
   message, then call
   `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the chat ID.

## Running Manually

### From GitHub

Go to **Actions > Micro-Cap Scanner > Run workflow**. You can optionally
set `top_n` to control how many picks are sent via Telegram (default: 20).

### Locally

```bash
export FMP_API_KEY="your-key"
export TELEGRAM_BOT_TOKEN="your-token"
export TELEGRAM_CHAT_ID="your-chat-id"

node scripts/microcap-scanner.mjs --top 200
node scripts/telegram-notify.mjs --top 10
```
