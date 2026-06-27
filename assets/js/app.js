let allItems = [];
let groups = [];

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function slug(key) {
  return `group-${String(key).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

function cardHtml(item) {
  return `
    <article class="news-card">
      <div class="news-meta">
        <span class="badge ${item.sourceType}">${escapeHtml(item.sourceLabel)}</span>
        <span class="badge type ${item.articleType}">${escapeHtml(item.articleLabel)}</span>
        <span>${escapeHtml(item.source)}</span>
        <span>${formatDate(item.pubDate)}</span>
      </div>
      <h3>
        <a href="${item.link}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item.title)}
        </a>
      </h3>
      <p>${escapeHtml(item.description || "No summary available.")}</p>
    </article>
  `;
}

function renderNews(items) {
  const container = document.getElementById("news-groups");
  const status = document.getElementById("status");

  if (!items.length) {
    status.textContent = "No matching stories found.";
    container.innerHTML = "";
    return;
  }

  status.textContent = `${items.length} stor${items.length === 1 ? "y" : "ies"} shown`;

  // Group the visible items by vaccine, preserving the order from the feed's group list.
  const byVaccine = {};
  for (const item of items) {
    (byVaccine[item.vaccineKey] = byVaccine[item.vaccineKey] || []).push(item);
  }

  const orderedKeys = groups.map(g => g.key).filter(k => byVaccine[k]);
  // Include any keys not in the summary list (safety net).
  for (const k of Object.keys(byVaccine)) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k);
  }

  container.innerHTML = orderedKeys.map(key => {
    const groupItems = byVaccine[key];
    const label =
      (groups.find(g => g.key === key) || {}).label || groupItems[0].vaccineLabel || "Other";
    return `
      <section class="vaccine-group" id="${slug(key)}">
        <h3 class="group-title">${escapeHtml(label)} <span class="group-count">${groupItems.length}</span></h3>
        <div class="news-grid">
          ${groupItems.map(cardHtml).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function renderVaccineNav() {
  const nav = document.getElementById("vaccine-nav");
  if (!groups.length) { nav.innerHTML = ""; return; }
  nav.innerHTML = groups.map(g =>
    `<a href="#${slug(g.key)}" class="vaccine-chip">${escapeHtml(g.label)} <span>${g.count}</span></a>`
  ).join("");
}

function populateVaccineFilter() {
  const select = document.getElementById("vaccineFilter");
  // Reset (keep the first "All vaccines" option).
  select.length = 1;
  for (const g of groups) {
    const opt = document.createElement("option");
    opt.value = g.key;
    opt.textContent = `${g.label} (${g.count})`;
    select.appendChild(opt);
  }
}

function applyFilters() {
  const query = document.getElementById("searchBox").value.trim().toLowerCase();
  const vaccine = document.getElementById("vaccineFilter").value;
  const sourceType = document.getElementById("sourceFilter").value;
  const articleType = document.getElementById("typeFilter").value;

  const filtered = allItems.filter(item => {
    const matchesText =
      item.title.toLowerCase().includes(query) ||
      item.source.toLowerCase().includes(query) ||
      (item.description || "").toLowerCase().includes(query);

    const matchesVaccine = vaccine === "all" || item.vaccineKey === vaccine;
    const matchesSource = sourceType === "all" || item.sourceType === sourceType;
    const matchesType = articleType === "all" || item.articleType === articleType;

    return matchesText && matchesVaccine && matchesSource && matchesType;
  });

  renderNews(filtered);
}

async function init() {
  const status = document.getElementById("status");

  try {
    const response = await fetch("data/news.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    allItems = payload.items || [];
    groups = payload.groups || [];

    document.getElementById("last-updated").textContent =
      `Last updated: ${formatDate(payload.updatedAt)}`;

    populateVaccineFilter();
    renderVaccineNav();
    renderNews(allItems);

    document.getElementById("searchBox").addEventListener("input", applyFilters);
    document.getElementById("vaccineFilter").addEventListener("change", applyFilters);
    document.getElementById("sourceFilter").addEventListener("change", applyFilters);
    document.getElementById("typeFilter").addEventListener("change", applyFilters);
  } catch (error) {
    console.error(error);
    status.innerHTML = `
      News could not be loaded right now.
      Please try again later or check the
      <a href="https://www.cidrap.umn.edu/" target="_blank" rel="noopener noreferrer">CIDRAP news page.</a>
      I'm not affiliated with them, but they do good work.
    `;
    document.getElementById("news-groups").innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", init);
