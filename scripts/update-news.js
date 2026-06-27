const fs = require("fs");
const Parser = require("rss-parser");

const parser = new Parser();

// Broad vaccine query. Google News RSS supports OR and quoted phrases.
const QUERY = '(vaccine OR vaccination OR immunization OR immunisation)';
const FEED_URL =
  "https://news.google.com/rss/search?q=" +
  encodeURIComponent(QUERY) +
  "&hl=en-US&gl=US&ceid=US:en";

// Anti-vaccine / known misinformation domains to exclude.
const BLOCKED_DOMAINS = [
  "childrenshealthdefense.org",
  "nvic.org",
  "learntherisk.org",
  "vaxxter.com",
  "thehighwire.com",
  "naturalnews.com",
  "mercola.com"
];

const OFFICIAL_DOMAINS = [
  "cdc.gov",
  "who.int",
  "fda.gov",
  "nih.gov",
  "hhs.gov",
  "ema.europa.eu",
  "ecdc.europa.eu",
  ".gov"
];

const ACADEMIC_DOMAINS = [
  ".edu",
  "cidrap.umn.edu",
  "nejm.org",
  "thelancet.com",
  "bmj.com",
  "jamanetwork.com",
  "nature.com",
  "sciencedirect.com"
];

// Vaccine-type groups. First matching group (by keyword) wins.
// Order matters: more specific terms first.
const VACCINE_GROUPS = [
  { key: "covid",        label: "COVID-19",            keywords: ["covid", "sars-cov-2", "coronavirus vaccine", "bivalent", "spikevax", "comirnaty", "novavax"] },
  { key: "flu",          label: "Influenza (flu)",     keywords: ["flu vaccine", "influenza", "fluzone", "flumist"] },
  { key: "rsv",          label: "RSV",                 keywords: ["rsv", "respiratory syncytial", "abrysvo", "arexvy"] },
  { key: "measles_mmr",  label: "Measles / MMR",       keywords: ["measles", "mmr", "mumps", "rubella"] },
  { key: "hpv",          label: "HPV",                 keywords: ["hpv", "human papillomavirus", "gardasil", "cervical cancer vaccine"] },
  { key: "polio",        label: "Polio",               keywords: ["polio", "poliovirus", "ipv", "opv"] },
  { key: "pertussis",    label: "Whooping cough / Tdap", keywords: ["whooping cough", "pertussis", "tdap", "dtap", "dtp"] },
  { key: "hepatitis",    label: "Hepatitis",           keywords: ["hepatitis", "hep b", "hep a", "hbv", "hav"] },
  { key: "pneumococcal", label: "Pneumococcal",        keywords: ["pneumococcal", "prevnar", "pneumovax", "pneumonia vaccine"] },
  { key: "meningococcal",label: "Meningococcal",       keywords: ["meningococcal", "meningitis vaccine", "menb", "menacwy"] },
  { key: "shingles",     label: "Shingles",            keywords: ["shingles", "herpes zoster", "shingrix", "zoster vaccine"] },
  { key: "chickenpox",   label: "Chickenpox",          keywords: ["chickenpox", "varicella"] },
  { key: "mpox",         label: "Mpox",                keywords: ["mpox", "monkeypox", "jynneos"] },
  { key: "rotavirus",    label: "Rotavirus",           keywords: ["rotavirus", "rotateq", "rotarix"] },
  { key: "rabies",       label: "Rabies",              keywords: ["rabies vaccine"] },
  { key: "dengue",       label: "Dengue",              keywords: ["dengue vaccine", "dengvaxia", "qdenga"] },
  { key: "malaria",      label: "Malaria",             keywords: ["malaria vaccine", "rts,s", "mosquirix", "r21"] }
];

// Article-type classification by keyword in the title.
function classifyArticleType(title) {
  const t = (title || "").toLowerCase();
  if (/\b(opinion|op-ed|editorial|commentary|perspective|viewpoint)\b/.test(t)) {
    return { articleType: "opinion", articleLabel: "Opinion" };
  }
  if (/\b(study|trial|research|journal|published|findings|preprint|peer-reviewed|clinical trial)\b/.test(t)) {
    return { articleType: "research", articleLabel: "Research" };
  }
  return { articleType: "news", articleLabel: "News" };
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifySource(link, sourceUrl) {
  const url = sourceUrl || link || "";
  const host = getHostname(url);

  if (OFFICIAL_DOMAINS.some(d => host.endsWith(d) || host.includes(d))) {
    return { sourceType: "official", sourceLabel: "Official public health", priority: 1 };
  }
  if (ACADEMIC_DOMAINS.some(d => host.endsWith(d) || host.includes(d))) {
    return { sourceType: "academic", sourceLabel: "Academic", priority: 2 };
  }
  return { sourceType: "news", sourceLabel: "News", priority: 3 };
}

function classifyVaccine(title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  for (const group of VACCINE_GROUPS) {
    if (group.keywords.some(k => text.includes(k))) {
      return { vaccineKey: group.key, vaccineLabel: group.label };
    }
  }
  return { vaccineKey: "general", vaccineLabel: "General / multiple vaccines" };
}

function isBlocked(link, sourceUrl) {
  const host1 = getHostname(link);
  const host2 = getHostname(sourceUrl || "");
  return BLOCKED_DOMAINS.some(d => host1.includes(d) || host2.includes(d));
}

function cleanText(text = "") {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeKey(item) {
  return item.title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed() {
  const response = await fetch(FEED_URL, {
    headers: { "user-agent": "Mozilla/5.0 vaccine-news-monitor" }
  });
  if (!response.ok) {
    throw new Error(`Feed request failed: HTTP ${response.status}`);
  }
  return response.text();
}

async function main() {
  const xml = await fetchFeed();
  const feed = await parser.parseString(xml);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const items = (feed.items || [])
    .map(item => {
      const sourceUrl = item.source?.url || item.enclosure?.url || "";
      const meta = classifySource(item.link, sourceUrl);
      const title = cleanText(item.title || "");
      const description = cleanText(item.contentSnippet || item.content || "").slice(0, 280);
      const vaccine = classifyVaccine(title, description);
      const articleMeta = classifyArticleType(title);

      return {
        title,
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        description,
        source: item.source?.title || item.creator || getHostname(item.link) || "Unknown source",
        sourceType: meta.sourceType,
        sourceLabel: meta.sourceLabel,
        priority: meta.priority,
        vaccineKey: vaccine.vaccineKey,
        vaccineLabel: vaccine.vaccineLabel,
        articleType: articleMeta.articleType,
        articleLabel: articleMeta.articleLabel,
        sourceUrl
      };
    })
    .filter(item => item.link)
    .filter(item => !isBlocked(item.link, item.sourceUrl))
    .filter(item => new Date(item.pubDate) >= sevenDaysAgo);

  const seen = new Set();
  const deduped = items.filter(item => {
    const key = dedupeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  // Build an ordered group summary so the front end can render vaccine nav.
  const groupCounts = {};
  for (const item of deduped) {
    groupCounts[item.vaccineKey] = (groupCounts[item.vaccineKey] || 0) + 1;
  }
  const orderedKeys = [...VACCINE_GROUPS.map(g => g.key), "general"];
  const groups = orderedKeys
    .filter(k => groupCounts[k])
    .map(k => {
      const label =
        k === "general"
          ? "General / multiple vaccines"
          : VACCINE_GROUPS.find(g => g.key === k).label;
      return { key: k, label, count: groupCounts[k] };
    });

  const payload = {
    updatedAt: new Date().toISOString(),
    itemCount: deduped.length,
    groups,
    items: deduped.map(({ priority, sourceUrl, ...rest }) => rest)
  };

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/news.json", JSON.stringify(payload, null, 2));
  console.log(`Saved ${payload.itemCount} items across ${groups.length} vaccine groups to data/news.json`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
