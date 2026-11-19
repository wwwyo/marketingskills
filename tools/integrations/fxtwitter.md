# FxTwitter

Free, keyless JSON API for reading a single public X (Twitter) post from its URL: text, author, timestamps, engagement counts, media, quoted post, and poll. Run by the open-source [FixTweet](https://github.com/FixTweet/FxTwitter) project, the service behind `fxtwitter.com` link embeds. It is unofficial and volunteer-run, not an X product.

Facts below were checked against the live API on 2026-11-19.

## Capabilities

| Integration | Available | Notes |
|-------------|-----------|-------|
| API | ✓ | REST, `https://api.fxtwitter.com`, GET only |
| MCP | - | Not available |
| CLI | - | Use `curl` + `jq` |
| SDK | - | Plain HTTP |

## Authentication

None. No key, no account, no published quota.

## When to Use It

Use it whenever the user hands you an `x.com` or `twitter.com` post URL and you need what it says. Opening the URL directly with a fetch tool usually returns a login wall or an empty JavaScript shell, not the post.

- **Reading one post** (to quote it, reply to it, analyze its hook, or log a competitor's post): use FxTwitter
- **A profile's recent posts, search, or bulk pulls**: FxTwitter cannot do these. Use [ScrapeCreators](scrapecreators.md) or an Apify X actor, or the official X API
- **Protected (locked) accounts, deleted posts, and full threads**: not available. A thread comes back as the single post you asked for; read the others by their own URLs if you have them

## Common Agent Operations

### Read a post from its URL

Swap the host for `api.fxtwitter.com` and keep the path. The username segment is not checked, so `/i/status/<id>` works when you only have the ID.

```bash
# https://x.com/jack/status/20  ->  https://api.fxtwitter.com/jack/status/20
curl -s "https://api.fxtwitter.com/jack/status/20" \
  | jq '.tweet | {url, text, author: .author.screen_name, created_at, likes, retweets, replies, quotes, bookmarks, views, lang}'
```

### Media, quote, and reply context

```bash
curl -s "https://api.fxtwitter.com/i/status/<id>" \
  | jq '.tweet | {
      text,
      replying_to,
      quote: (.quote | if . then {url, text, author: .author.screen_name} else null end),
      photos: [.media.photos[]?.url],
      videos: [.media.videos[]? | {url, thumbnail_url, duration}],
      poll: (.poll | if . then [.choices[] | {label, percentage}] else null end)
    }'
```

## Response Notes

- Success is `{"code": 200, "message": "OK", "tweet": {...}}`. Check `.code == 200` before trusting the body
- A post that does not exist, is deleted, or is protected may come back as an HTML page with HTTP 200 rather than JSON. If `jq` fails to parse, treat the post as unavailable instead of retrying
- `views` is often `null`, especially on older posts
- `created_at` is in X's legacy format (`Tue Mar 21 20:50:14 +0000 2006`); `created_timestamp` is Unix seconds
- Long posts (over 280 characters) come back in full in `text`

## Caveats

- Unofficial and free: it can slow down, change shape, or stop working when X changes its internals. Do not build a scheduled pipeline that depends on it without a fallback
- Counts are a snapshot at fetch time; record the fetch date when you log them
- For anything beyond reading posts you were given (monitoring, bulk research), use a paid, supported source

## Relevant Skills

- social (reading a post to reply to, reverse-engineering what a post did well)
- competitors, reverse-engineer-marketing (logging a competitor's specific posts)
- customer-research (reading a post a customer linked)
