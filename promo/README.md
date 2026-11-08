# Promo images & videos — Sudan ICT Marketplace

All files were made on 8 Nov 2026 from the real site design (logo, colours, Cairo font, real products and companies).

## Videos (24 s, MP4 H.264, 30 fps, no sound)

| File | Size | Use it for |
|---|---|---|
| `sictm-promo-vertical-1080x1920.mp4` | 9:16 | WhatsApp status, Instagram Reels & Stories, TikTok, Facebook Reels, YouTube Shorts |
| `sictm-promo-landscape-1920x1080.mp4` | 16:9 | YouTube, Facebook feed, website, presentations, **Google Play promo video** (upload to YouTube first, then paste the YouTube link in Play Console) |

Storyline: logo intro → search ("ابحث عن أي منتج أو خدمة تقنية") → products list → product + **Ask price on WhatsApp** → WhatsApp chat with the company → verified companies → `sictm.net` + "حمّل التطبيق: sictm.net/app".

The videos are silent so you can add music in any app (CapCut, Instagram, TikTok) using their licensed music library.

## Images

| File | Size | Use it for |
|---|---|---|
| `sictm-share-1200x630.jpg` / `.png` | 1200×630 | Link preview when sictm.net is shared (already live as `sictm.net/og-image.jpg`), Facebook / LinkedIn / X posts |
| `play-feature-graphic-1024x500.png` | 1024×500 | **Google Play feature graphic** (required) |
| `play-screenshot-1-search.png` … `play-screenshot-5-companies.png` | 1080×1920 | **Google Play phone screenshots** (upload all 5, in order) |
| `social-square-1080x1080.png` | 1080×1080 | Instagram / Facebook feed post, WhatsApp |
| `social-story-1080x1920.png` | 1080×1920 | WhatsApp status, Instagram / Facebook Stories |
| `youtube-thumbnail-1280x720.jpg` | 1280×720 | YouTube video thumbnail |

Google Play also needs the 512×512 app icon: use `../deploy/icons/icon-512.png`.

## Suggested post text

> 🇸🇩 **سوق السودان للتقنية والاتصالات**
> أجهزة، شبكات، سيرفرات، سحابة وأمن سيبراني من شركات سودانية موثوقة.
> اسأل عن السعر مباشرة عبر واتساب ✅
> 🌐 sictm.net  |  📱 حمّل التطبيق: sictm.net/app
>
> **Sudan ICT Marketplace** — IT hardware, networks, cloud and cybersecurity from trusted Sudanese companies. Ask the price instantly on WhatsApp. sictm.net

## Editing / re-making them

The designs are code in `studio/index.html` (texts, colours, timings at the top of each section). To re-render:

1. In Claude Code, start the `sictm-promo` preview (defined in `.claude/launch.json`; it serves `promo/studio` on port 8788 and saves results into `promo/`).
2. In the page console run, for example:
   - `renderImage('og', 1200, 630, 'sictm-share-1200x630.png')`
   - `renderImage('ss1', 1080, 1920, 'play-screenshot-1-search.png')` (also `feature`, `square`, `story`, `ss2`–`ss5`)
   - `encodeVideo(1080, 1920, 'sictm-promo-vertical-1080x1920.mp4', 30, 5e6)` / `encodeVideo(1920, 1080, 'sictm-promo-landscape-1920x1080.mp4', 30, 6e6)`

If prices, products or companies change on the site, update `PRODUCTS` and the company list in `studio/index.html` and re-render so the promo stays accurate.
