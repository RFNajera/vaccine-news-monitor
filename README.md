# Vaccine News Monitor

A static GitHub Pages dashboard that displays recent vaccine-related news, grouped by
vaccine type, and refreshes hourly with GitHub Actions. Modeled on the
[Measles News Monitor](https://github.com/RFNajera/measles-news-monitor).

## What is included

- A polished GitHub Pages front end (hero, sidebar, search, filters)
- A scheduled GitHub Action that runs every hour
- A Node script that fetches Google News RSS results for vaccines
- Deduplication, source classification, and **vaccine-type grouping**
- Article-type tagging (news / opinion / research)
- An anti-vaccine / misinformation domain blocklist
- Local JSON output at `data/news.json`

## Features beyond the Measles Monitor

- **Vaccine grouping:** headlines are sorted into groups (COVID-19, influenza, RSV,
  measles/MMR, HPV, polio, and more), with a jump-nav and a vaccine filter dropdown.
- **Article-type filter:** filter by news, opinion, or research.

## Before you deploy

1. Create a new GitHub repository named `vaccine-news-monitor`.
2. Upload all files from this package.
3. In `index.html`, the `og:url` meta tag is set to
   `https://rfnajera.github.io/vaccine-news-monitor/` — adjust if your path differs.
4. Commit to your default branch (`main`).
5. In GitHub, go to **Settings > Pages** and set the site to deploy from the `main` branch.
6. In GitHub, go to **Actions** and allow workflows if prompted.
7. Run the **Update vaccine news** workflow once manually from the Actions tab.

## Notes

- The workflow runs at minute 25 of every hour in UTC.
- Scheduled workflows run from the default branch.
- The page reads a static `data/news.json`, so there are no browser CORS issues.

## Customizing

- **Blocked sources:** edit `BLOCKED_DOMAINS` in `scripts/update-news.js`.
- **Vaccine groups / keywords:** edit `VACCINE_GROUPS` in `scripts/update-news.js`.
- **Schedule:** edit `.github/workflows/update-news.yml`.

## Local testing

```bash
npm install
npm run update-news
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Credit

Vaccine News Monitor by René F. Najera. Source articles are provided by Google News
RSS and their original publishers.
