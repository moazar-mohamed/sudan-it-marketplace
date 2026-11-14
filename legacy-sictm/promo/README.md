# Promo images & videos — Sudan ICT Marketplace

All files were made on 8 Nov 2026 from the real site design (logo, colours, Cairo font, real products and companies).

## Videos (24 s, MP4 H.264, 30 fps, no sound)

| File | Size | Use it for |
|---|---|---|
| `sictm-promo-vertical-1080x1920.mp4` | 9:16 | WhatsApp status, Instagram Reels & Stories, TikTok, Facebook Reels, YouTube Shorts |
| `sictm-promo-landscape-1920x1080.mp4` | 16:9 | YouTube, Facebook feed, website, presentations, **Google Play promo video** (upload to YouTube first, then paste the YouTube link in Play Console) |

Storyline: logo intro → search ("ابحث عن أي منتج أو خدمة تقنية") → products list → product + **Ask price on WhatsApp** → WhatsApp chat with the company → verified companies → `sictm.net` + "حمّل التطبيق: sictm.net/app".

The videos are silent so you can add music in any app (CapCut, Instagram, TikTok) using their licensed music library.

### Full platform tour with Arabic voice-over (9 Nov 2026, 49.5 s, MP4 H.264 + AAC stereo, 30 fps)

| File | Size | Use it for |
|---|---|---|
| `sictm-full-tour-vertical-1080x1920.mp4` | 9:16 | WhatsApp status (under 60 s), Reels, Stories, TikTok, Shorts |
| `sictm-full-tour-landscape-1920x1080.mp4` | 16:9 | YouTube, Facebook, website, presentations, Google Play promo video |

All 11 scenes in one video, with close-up zooms on the key details (search box, WhatsApp button, installation badge, invoice totals, rating stars): search → products → WhatsApp price → chat with the company → verified companies → installation + Buy now → cart per company → checkout with installation fee → technicians + assigning → accept & rate → Google sign-in → `sictm.net`.

Voice-over: generated offline with the Windows Arabic voice **Microsoft Naayf**. Lines are in `studio/vo/lines.txt`; edit them and run `studio/vo/make-voice.ps1` to regenerate the clips (`-Rate 1.05` is the speed used). If you record your own voice (or use a better voice), save the clips with the same names (`intro.wav`, `home.wav` … `outro.wav`) in `studio/vo/` and re-render. Each line must fit its scene (see `VO` times in `TL.full`).

Detailed stills for the new features (1080×1920, for Google Play or posts): `play-screenshot-6-installation.png`, `-7-cart-per-company.png`, `-8-checkout.png`, `-9-technicians.png`, `-10-ratings.png`, `-11-google-signin.png`.

### "What's new" update videos (9 Nov 2026, 29 s, MP4 H.264, 30 fps, no sound)

| File | Size | Use it for |
|---|---|---|
| `sictm-update-vertical-1080x1920.mp4` | 9:16 | WhatsApp status, Reels, Stories, TikTok, Shorts |
| `sictm-update-landscape-1920x1080.mp4` | 16:9 | YouTube, Facebook feed, website, presentations |

Storyline: logo + "✨ تحديث جديد · New update" → product with **🔧 installation service** and **⚡ Buy now** → **cart split per company** (separate order & invoice) → **checkout with installation fee** → company **technicians** and **assigning a technician** → customer **accepts the installation and rates** technician / service / product → **sign in with Google** → `sictm.net` + app link.

Suggested post text:

> ✨ **تحديث جديد في سوق السودان للتقنية والاتصالات**
> 🔧 خدمة التركيب مع المنتج — والرسوم واضحة في الفاتورة
> 🧾 طلب وفاتورة منفصلة لكل شركة
> 👷 الشركة تعيّن فنياً متخصصاً، وأنت تقبل التركيب وتقيّم الفني والخدمة ⭐
> 🔑 دخول سريع بحساب Google
> 🌐 sictm.net  |  📱 sictm.net/app

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
   - Update video: first `useTL('update')`, then `encodeVideo(1080, 1920, 'sictm-update-vertical-1080x1920.mp4', 30, 5e6)` / `encodeVideo(1920, 1080, 'sictm-update-landscape-1920x1080.mp4', 30, 6e6)`. `useTL('promo')` switches back to the original video.
   - Full tour with voice-over: `useTL('full')`, then `encodeVideo(1080, 1920, 'sictm-full-tour-vertical-1080x1920.mp4', 30, 5e6)` / `encodeVideo(1920, 1080, 'sictm-full-tour-landscape-1920x1080.mp4', 30, 6e6)` (each takes about a minute; the voice clips in `studio/vo/` are mixed in automatically).
   - New-feature stills: `renderImage('ss6', 1080, 1920, 'play-screenshot-6-installation.png')` … `ss11`.

If prices, products or companies change on the site, update `PRODUCTS` and the company list in `studio/index.html` and re-render so the promo stays accurate.
