const DEFAULT_COLORS = ["#1f2937", "#1f2937", "#1f2937", "#1f2937", "#1f2937"];
const MULTI_TYPE_COLOR = "#b967ff";
const STAT_HEAT_COLOR = "#05ffa1";
const FALLBACK_VAPORWAVE = ["#f15bb5", "#fee440", "#00bbf9", "#00f5d4", "#9b5de5", "#fb5607", "#ffbe0b", "#72efdd"];
let TYPE_META = {};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const typeButtons = document.getElementById("typeButtons");
const yearButtons = document.getElementById("yearButtons");
const typeMenu = document.getElementById("typeMenu");
const yearMenu = document.getElementById("yearMenu");
const typeMenuButton = document.getElementById("typeMenuButton");
const yearMenuButton = document.getElementById("yearMenuButton");
const typeMenuLabel = document.getElementById("typeMenuLabel");
const yearMenuLabel = document.getElementById("yearMenuLabel");
const typeClearButton = document.getElementById("typeClearButton");
const yearClearButton = document.getElementById("yearClearButton");
const typeMenuOptions = document.getElementById("typeMenuOptions");
const yearMenuOptions = document.getElementById("yearMenuOptions");
const heatmaps = document.getElementById("heatmaps");
const stats = document.getElementById("stats");
const tooltip = document.getElementById("tooltip");
const summary = document.getElementById("summary");
const updated = document.getElementById("updated");
const repoLink = document.querySelector(".repo-link");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

function inferGitHubRepoFromLocation(loc) {
  const host = String(loc.hostname || "").toLowerCase();
  const pathParts = String(loc.pathname || "")
    .split("/")
    .filter(Boolean);

  if (host.endsWith(".github.io")) {
    const owner = host.replace(/\.github\.io$/, "");
    if (!owner) return null;
    const repo = pathParts[0] || `${owner}.github.io`;
    return { owner, repo };
  }

  if (host === "github.com" && pathParts.length >= 2) {
    return { owner: pathParts[0], repo: pathParts[1] };
  }

  return null;
}

function syncRepoLink() {
  if (!repoLink) return;
  const inferred = inferGitHubRepoFromLocation(window.location);
  if (!inferred) return;
  const href = `https://github.com/${inferred.owner}/${inferred.repo}`;
  repoLink.href = href;
  repoLink.textContent = `${inferred.owner}/${inferred.repo}`;
}

function readCssVar(name, fallback, scope) {
  const target = scope || document.body || document.documentElement;
  const value = getComputedStyle(target).getPropertyValue(name).trim();
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLayout(scope) {
  return {
    cell: readCssVar("--cell", 12, scope),
    gap: readCssVar("--gap", 2, scope),
    gridPadTop: readCssVar("--grid-pad-top", 6, scope),
    gridPadLeft: readCssVar("--grid-pad-left", 6, scope),
    gridPadRight: readCssVar("--grid-pad-right", 4, scope),
    gridPadBottom: readCssVar("--grid-pad-bottom", 6, scope),
  };
}

function resetStackedStatsOffset(statsColumn) {
  if (!statsColumn) return;
  statsColumn.style.marginLeft = "";
  statsColumn.style.maxWidth = "";
}

function getContentBoxLeft(container) {
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  const styles = getComputedStyle(container);
  const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  return rect.left + borderLeft + paddingLeft;
}

let textMeasureContext = null;

function measureLabelTextWidth(label, text, styles) {
  if (!text || !label) return 0;
  if (!textMeasureContext) {
    const canvas = document.createElement("canvas");
    textMeasureContext = canvas.getContext("2d");
  }
  if (!textMeasureContext) return 0;

  const font = styles.font && styles.font !== "normal"
    ? styles.font
    : `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`;
  textMeasureContext.font = font;

  let width = textMeasureContext.measureText(text).width;
  const letterSpacing = parseFloat(styles.letterSpacing);
  if (Number.isFinite(letterSpacing) && text.length > 1) {
    width += letterSpacing * (text.length - 1);
  }
  return width;
}

function getLabelTextLeft(label) {
  if (!label) return null;
  const text = (label.textContent || "").trim();
  const styles = getComputedStyle(label);
  const labelRect = label.getBoundingClientRect();
  if (!text) return Number.isFinite(labelRect.left) ? labelRect.left : null;

  const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
  const borderRight = parseFloat(styles.borderRightWidth) || 0;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingRight = parseFloat(styles.paddingRight) || 0;
  const contentLeft = labelRect.left + borderLeft + paddingLeft;
  const contentRight = labelRect.right - borderRight - paddingRight;
  const contentWidth = Math.max(0, contentRight - contentLeft);
  const measuredWidth = Math.max(0, measureLabelTextWidth(label, text, styles));
  const textWidth = Math.min(measuredWidth, contentWidth || measuredWidth);

  const align = styles.textAlign;
  if (align === "right" || align === "end") {
    return contentRight - textWidth;
  }
  if (align === "center") {
    return contentLeft + Math.max(0, (contentWidth - textWidth) / 2);
  }
  if (align === "left" || align === "start") {
    return contentLeft;
  }

  return contentLeft;
}

function getLeftMostLabelOffset(container, labels) {
  if (!container || !labels?.length) return null;
  const containerLeft = getContentBoxLeft(container);
  if (!Number.isFinite(containerLeft)) return null;

  const minLeft = labels.reduce((currentMin, label) => {
    const left = getLabelTextLeft(label);
    if (!Number.isFinite(left)) return currentMin;
    return Math.min(currentMin, left);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(minLeft)) return null;
  return Math.max(0, Math.round(minLeft - containerLeft));
}

function getLeftMostLabelEdge(labels) {
  if (!labels?.length) return null;
  const minLeft = labels.reduce((currentMin, label) => {
    const left = getLabelTextLeft(label);
    if (!Number.isFinite(left)) return currentMin;
    return Math.min(currentMin, left);
  }, Number.POSITIVE_INFINITY);
  return Number.isFinite(minLeft) ? minLeft : null;
}

function parseTranslateX(transformValue) {
  if (!transformValue || transformValue === "none") return 0;
  const match = transformValue.match(/translateX\(([-\d.]+)px\)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : 0;
}

function pinStackedStatsToLabelEdge(statsColumn, container, labels) {
  if (!statsColumn) return;
  const offset = getLeftMostLabelOffset(container, labels);
  if (!Number.isFinite(offset)) {
    resetStackedStatsOffset(statsColumn);
    return;
  }
  statsColumn.style.marginLeft = `${offset}px`;
  statsColumn.style.maxWidth = `calc(100% - ${offset}px)`;
}

function getCardOuterGap(card, labels) {
  if (!card || !labels?.length) return null;
  const cardRect = card.getBoundingClientRect();
  const labelLeft = getLeftMostLabelEdge(labels);
  if (!Number.isFinite(cardRect.left) || !Number.isFinite(labelLeft)) return null;
  return Math.max(0, Math.round(labelLeft - cardRect.left));
}

let frequencyLastViewportWidth = window.innerWidth;
let frequencyStackLocks = new Map();
let yearLastViewportWidth = window.innerWidth;
let yearStackLocks = new Map();

function normalizeSummaryStatCardWidths() {
  if (!heatmaps) return;

  const yearCards = Array.from(
    heatmaps.querySelectorAll(".year-card .card-stats.side-stats-column .card-stat"),
  );
  const allFrequencyCards = Array.from(
    heatmaps.querySelectorAll(".more-stats-facts.side-stats-column .more-stats-fact-card"),
  );
  const frequencyCards = allFrequencyCards.filter((card) => (
    !card.closest(".more-stats")?.classList.contains("more-stats-stacked")
  ));
  const cards = [...yearCards, ...frequencyCards];
  if (!cards.length) return;

  [...yearCards, ...allFrequencyCards].forEach((card) => {
    card.style.width = "";
    card.style.maxWidth = "";
  });

  if (!window.matchMedia("(min-width: 721px)").matches) {
    return;
  }

  const maxWidth = cards.reduce((max, card) => {
    const width = Math.ceil(card.getBoundingClientRect().width);
    return Number.isFinite(width) ? Math.max(max, width) : max;
  }, 0);
  if (!maxWidth) return;

  const desktopCards = Array.from(
    heatmaps.querySelectorAll(".card.year-card, .card.more-stats"),
  );

  let targetWidth = maxWidth;
  const minWidth = 128;

  const applyWidth = (width) => {
    cards.forEach((card) => {
      card.style.width = `${width}px`;
      card.style.maxWidth = `${width}px`;
    });
  };

  for (let i = 0; i < 8; i += 1) {
    applyWidth(targetWidth);
    const overflow = desktopCards.reduce((max, card) => (
      Math.max(max, Math.ceil(card.scrollWidth - card.clientWidth))
    ), 0);
    if (overflow <= 0) {
      break;
    }
    const next = targetWidth - Math.ceil(overflow / 2);
    if (next <= minWidth) {
      targetWidth = minWidth;
      break;
    }
    targetWidth = next;
  }

  applyWidth(targetWidth);
}

function alignFrequencyTitleGapToYearGap() {
  if (!heatmaps) return;

  const referenceYearCard = heatmaps.querySelector(".year-card");
  if (!referenceYearCard) return;

  const yearTitle = referenceYearCard.querySelector(".card-title.labeled-card-title");
  const yearFirstLabel = referenceYearCard.querySelector(".month-row .month-label");
  if (!yearTitle || !yearFirstLabel) return;

  const targetGap = yearFirstLabel.getBoundingClientRect().top - yearTitle.getBoundingClientRect().bottom;
  if (!Number.isFinite(targetGap)) return;

  heatmaps.querySelectorAll(".more-stats").forEach((frequencyCard) => {
    const title = frequencyCard.querySelector(".card-title.labeled-card-title");
    const firstLabel = frequencyCard.querySelector(".axis-month-row .month-label");
    const body = frequencyCard.querySelector(".more-stats-body");
    if (!title || !firstLabel || !body) return;

    body.style.marginTop = "0px";
    const currentGap = firstLabel.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
    if (!Number.isFinite(currentGap)) return;

    const correction = Math.round(currentGap - targetGap);
    body.style.marginTop = `${-correction}px`;
  });
}

function syncFrequencyStackingMode() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;
  const viewportWidth = window.innerWidth;
  const narrowing = viewportWidth <= frequencyLastViewportWidth;
  const nextLocks = new Map();

  const cards = Array.from(heatmaps.querySelectorAll(".more-stats"));
  cards.forEach((card, index) => {
    const body = card.querySelector(".more-stats-body");
    const facts = card.querySelector(".more-stats-facts.side-stats-column");
    if (!body || !facts) return;

    card.style.setProperty("--more-stats-facts-shift", "0px");
    card.style.setProperty("--more-stats-second-col-shift", "0px");
    card.style.setProperty("--more-stats-third-col-shift", "0px");
    facts.style.width = "";
    facts.style.maxWidth = "";
    card.classList.remove("more-stats-stacked");
    if (!desktop) {
      return;
    }

    const sideGap = readCssVar("--stats-column-gap", 12, card);
    const requiredWidth = Math.ceil(body.scrollWidth + sideGap + facts.scrollWidth);
    const availableWidth = Math.floor(card.clientWidth);
    const needsStack = requiredWidth > availableWidth;
    const wasLocked = frequencyStackLocks.get(index) === true;
    const keepLocked = wasLocked && narrowing;
    const shouldStack = needsStack || keepLocked;

    if (shouldStack) {
      card.classList.add("more-stats-stacked");
      nextLocks.set(index, true);
    }
  });

  frequencyStackLocks = nextLocks;
  frequencyLastViewportWidth = viewportWidth;
}

function syncYearStackingMode() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;
  const viewportWidth = window.innerWidth;
  const narrowing = viewportWidth <= yearLastViewportWidth;
  const nextLocks = new Map();

  const cards = Array.from(heatmaps.querySelectorAll(".year-card"));
  cards.forEach((card, index) => {
    const heatmapArea = card.querySelector(".heatmap-area");
    const statsColumn = card.querySelector(".card-stats.side-stats-column");
    if (!heatmapArea || !statsColumn) return;

    card.classList.remove("year-card-stacked");
    if (!desktop) {
      return;
    }

    const sideGap = readCssVar("--stats-column-gap", 12, card);
    const requiredWidth = Math.ceil(heatmapArea.scrollWidth + sideGap + statsColumn.scrollWidth);
    const availableWidth = Math.floor(card.clientWidth);
    const needsStack = requiredWidth > availableWidth;
    const wasLocked = yearStackLocks.get(index) === true;
    const keepLocked = wasLocked && narrowing;
    const shouldStack = needsStack || keepLocked;

    if (shouldStack) {
      card.classList.add("year-card-stacked");
      nextLocks.set(index, true);
    }
  });

  yearStackLocks = nextLocks;
  yearLastViewportWidth = viewportWidth;
}

function syncSectionStackingMode() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;
  if (!desktop) return;

  heatmaps.querySelectorAll(".type-list").forEach((list) => {
    const frequencyCard = list.querySelector(".labeled-card-row-frequency .more-stats");
    const yearCards = Array.from(list.querySelectorAll(".labeled-card-row-year .year-card"));
    if (!frequencyCard && !yearCards.length) return;

    const shouldStack = Boolean(
      frequencyCard?.classList.contains("more-stats-stacked")
      || yearCards.some((card) => card.classList.contains("year-card-stacked")),
    );

    if (frequencyCard) {
      frequencyCard.classList.toggle("more-stats-stacked", shouldStack);
    }
    yearCards.forEach((card) => {
      card.classList.toggle("year-card-stacked", shouldStack);
    });
  });
}

function alignFrequencyGraphsToYearCardEdge() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;

  heatmaps.querySelectorAll(".labeled-card-row-frequency").forEach((row) => {
    const frequencyCard = row.querySelector(".more-stats");
    if (!frequencyCard) return;
    if (frequencyCard.classList.contains("more-stats-stacked")) return;

    frequencyCard.style.setProperty("--more-stats-second-col-shift", "0px");
    frequencyCard.style.setProperty("--more-stats-third-col-shift", "0px");
    if (!desktop) return;

    const thirdGraph = frequencyCard.querySelector(".more-stats-grid > .more-stats-col:nth-child(3)");
    if (!thirdGraph) return;

    let referenceRow = row.nextElementSibling;
    while (referenceRow && !referenceRow.classList.contains("labeled-card-row-year")) {
      referenceRow = referenceRow.nextElementSibling;
    }
    const referenceYearGraph = referenceRow?.querySelector(".card.year-card .heatmap-area");
    if (!referenceYearGraph) return;

    const thirdRight = thirdGraph.getBoundingClientRect().right;
    const targetRight = referenceYearGraph.getBoundingClientRect().right;
    const delta = Math.round(targetRight - thirdRight);

    // Never shift columns left during resize transitions; allow horizontal scrolling instead.
    const secondShift = Math.max(0, Math.round(delta / 2));
    const thirdShift = Math.max(0, delta);

    frequencyCard.style.setProperty("--more-stats-second-col-shift", `${secondShift}px`);
    frequencyCard.style.setProperty("--more-stats-third-col-shift", `${thirdShift}px`);
  });
}

function alignFrequencyFactsToYearCardEdge() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;

  heatmaps.querySelectorAll(".labeled-card-row-frequency").forEach((row) => {
    const frequencyCard = row.querySelector(".more-stats");
    if (!frequencyCard) return;
    const factsColumn = frequencyCard.querySelector(".more-stats-facts.side-stats-column");
    if (!factsColumn) return;

    factsColumn.style.width = "";
    factsColumn.style.maxWidth = "";
    frequencyCard.style.setProperty("--more-stats-facts-shift", "0px");

    if (frequencyCard.classList.contains("more-stats-stacked")) {
      return;
    }
    if (!desktop) return;

    let referenceRow = row.nextElementSibling;
    while (referenceRow && !referenceRow.classList.contains("labeled-card-row-year")) {
      referenceRow = referenceRow.nextElementSibling;
    }
    const referenceStats = referenceRow?.querySelector(".card.year-card .card-stats.side-stats-column");
    if (!referenceStats) return;

    const targetWidth = Math.ceil(referenceStats.getBoundingClientRect().width);
    if (targetWidth > 0) {
      factsColumn.style.width = `${targetWidth}px`;
      factsColumn.style.maxWidth = `${targetWidth}px`;
    }
  });
}

function alignYearStatsToFrequencyEdge() {
  if (!heatmaps) return;

  const allYearStats = Array.from(
    heatmaps.querySelectorAll(".labeled-card-row-year .year-card .card-stats.side-stats-column"),
  );
  allYearStats.forEach((statsColumn) => {
    statsColumn.style.transform = "";
  });

  const desktop = window.matchMedia("(min-width: 721px)").matches;
  if (!desktop) return;

  heatmaps.querySelectorAll(".type-list").forEach((list) => {
    const frequencyCard = list.querySelector(".labeled-card-row-frequency .more-stats");
    const frequencyFacts = list.querySelector(
      ".labeled-card-row-frequency .more-stats .more-stats-facts.side-stats-column",
    );
    if (!frequencyCard || !frequencyFacts) return;

    const frequencyStacked = frequencyCard.classList.contains("more-stats-stacked");
    if (frequencyStacked) return;

    const targetLeft = frequencyFacts.getBoundingClientRect().left;
    if (!Number.isFinite(targetLeft)) return;

    list.querySelectorAll(".labeled-card-row-year .year-card").forEach((yearCard) => {
      const statsColumn = yearCard.querySelector(".card-stats.side-stats-column");
      if (!statsColumn) return;
      const yearStacked = yearCard.classList.contains("year-card-stacked");
      if (yearStacked !== frequencyStacked) return;

      const currentLeft = statsColumn.getBoundingClientRect().left;
      if (!Number.isFinite(currentLeft)) return;

      const shift = Math.round(targetLeft - currentLeft);
      if (shift !== 0) {
        statsColumn.style.transform = `translateX(${shift}px)`;
      }
    });
  });
}

function applyDesktopStatsRightInset() {
  if (!heatmaps) return;
  const desktop = window.matchMedia("(min-width: 721px)").matches;

  heatmaps.querySelectorAll(".year-card").forEach((card) => {
    const statsColumn = card.querySelector(".card-stats.side-stats-column");
    const yLabels = Array.from(card.querySelectorAll(".heatmap-area .day-col .day-label"));
    if (!statsColumn) return;
    if (!desktop || card.classList.contains("year-card-stacked")) return;

    const leftGap = getCardOuterGap(card, yLabels);
    if (!Number.isFinite(leftGap)) return;

    const cardRect = card.getBoundingClientRect();
    const currentRight = statsColumn.getBoundingClientRect().right;
    if (!Number.isFinite(cardRect.right) || !Number.isFinite(currentRight)) return;

    const targetRight = cardRect.right - leftGap;
    const delta = Math.round(targetRight - currentRight);
    if (delta === 0) return;

    const baseShift = parseTranslateX(statsColumn.style.transform);
    const nextShift = baseShift + delta;
    statsColumn.style.transform = nextShift === 0 ? "" : `translateX(${nextShift}px)`;
  });

  heatmaps.querySelectorAll(".more-stats").forEach((card) => {
    const statsColumn = card.querySelector(".more-stats-facts.side-stats-column");
    const yLabels = Array.from(card.querySelectorAll(".more-stats-body .axis-day-col .axis-y-label"));
    if (!statsColumn) return;
    card.style.setProperty("--more-stats-facts-shift", "0px");
    if (!desktop || card.classList.contains("more-stats-stacked")) return;

    const leftGap = getCardOuterGap(card, yLabels);
    if (!Number.isFinite(leftGap)) return;

    const cardRect = card.getBoundingClientRect();
    const currentRight = statsColumn.getBoundingClientRect().right;
    if (!Number.isFinite(cardRect.right) || !Number.isFinite(currentRight)) return;

    const targetRight = cardRect.right - leftGap;
    const delta = Math.round(targetRight - currentRight);
    if (delta !== 0) {
      card.style.setProperty("--more-stats-facts-shift", `${delta}px`);
    }
  });
}

function alignStackedStatsToYAxisLabels() {
  if (!heatmaps) return;
  syncFrequencyStackingMode();
  normalizeSummaryStatCardWidths();
  syncFrequencyStackingMode();
  syncYearStackingMode();
  syncSectionStackingMode();
  alignFrequencyTitleGapToYearGap();
  alignFrequencyGraphsToYearCardEdge();
  alignFrequencyFactsToYearCardEdge();
  syncFrequencyStackingMode();
  syncYearStackingMode();
  syncSectionStackingMode();

  heatmaps.querySelectorAll(".year-card").forEach((card) => {
    const body = card.querySelector(".card-body");
    const heatmapArea = card.querySelector(".heatmap-area");
    const yLabels = Array.from(card.querySelectorAll(".heatmap-area .day-col .day-label"));
    const statsColumn = card.querySelector(".card-stats.side-stats-column");
    if (!body || !heatmapArea || !statsColumn) return;

    const heatmapBottom = heatmapArea.getBoundingClientRect().bottom;
    const statsTop = statsColumn.getBoundingClientRect().top;
    const isStacked = statsTop >= heatmapBottom - 1;
    if (isStacked) {
      pinStackedStatsToLabelEdge(statsColumn, body, yLabels);
      return;
    }
    resetStackedStatsOffset(statsColumn);
  });

  heatmaps.querySelectorAll(".more-stats").forEach((card) => {
    const yLabels = Array.from(card.querySelectorAll(".more-stats-body .axis-day-col .axis-y-label"));
    const graphBody = card.querySelector(".more-stats-body");
    const statsColumn = card.querySelector(".more-stats-facts.side-stats-column");
    if (!graphBody || !statsColumn) return;
    if (card.classList.contains("more-stats-stacked")) {
      pinStackedStatsToLabelEdge(statsColumn, card, yLabels);
      return;
    }

    const graphBottom = graphBody.getBoundingClientRect().bottom;
    const statsTop = statsColumn.getBoundingClientRect().top;
    const isStacked = statsTop >= graphBottom - 1;
    if (isStacked) {
      pinStackedStatsToLabelEdge(statsColumn, card, yLabels);
      return;
    }
    resetStackedStatsOffset(statsColumn);
  });

  alignYearStatsToFrequencyEdge();
  applyDesktopStatsRightInset();
}

function sundayOnOrBefore(d) {
  const day = d.getDay();
  const offset = day % 7; // Sunday=0
  const result = new Date(d);
  result.setDate(d.getDate() - offset);
  return result;
}

function saturdayOnOrAfter(d) {
  const day = d.getDay();
  const offset = (6 - day + 7) % 7;
  const result = new Date(d);
  result.setDate(d.getDate() + offset);
  return result;
}

function formatLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekOfYear(date) {
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const start = sundayOnOrBefore(yearStart);
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor((date - start) / msPerWeek) + 1;
}

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function heatColor(hex, value, max) {
  if (max <= 0) return DEFAULT_COLORS[0];
  if (value <= 0) return "#0f172a";
  const rgb = hexToRgb(hex);
  const base = hexToRgb("#0f172a");
  if (!rgb || !base) return hex;
  const intensity = Math.pow(Math.min(value / max, 1), 0.75);
  const r = Math.round(base.r + (rgb.r - base.r) * intensity);
  const g = Math.round(base.g + (rgb.g - base.g) * intensity);
  const b = Math.round(base.b + (rgb.b - base.b) * intensity);
  return `rgb(${r}, ${g}, ${b})`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function positionTooltip(x, y) {
  const padding = 12;
  const rect = tooltip.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - padding;
  const maxY = window.innerHeight - rect.height - padding;
  const left = clamp(x + 12, padding, maxX);
  const top = clamp(y + 12, padding, maxY);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.bottom = "auto";
}

function showTooltip(text, x, y) {
  tooltip.textContent = text;
  if (isTouch) {
    tooltip.classList.add("touch");
    tooltip.style.transform = "none";
  } else {
    tooltip.classList.remove("touch");
    tooltip.style.transform = "translateY(-8px)";
  }
  tooltip.classList.add("visible");
  requestAnimationFrame(() => positionTooltip(x, y));
}

function hideTooltip() {
  tooltip.classList.remove("visible");
}

function attachTooltip(cell, text) {
  if (!text) return;
  if (!isTouch) {
    cell.addEventListener("mouseenter", (event) => {
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mousemove", (event) => {
      showTooltip(text, event.clientX, event.clientY);
    });
    cell.addEventListener("mouseleave", hideTooltip);
    return;
  }
  cell.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    event.preventDefault();
    if (cell.classList.contains("active")) {
      cell.classList.remove("active");
      hideTooltip();
      return;
    }
    const active = document.querySelector(".cell.active");
    if (active) active.classList.remove("active");
    cell.classList.add("active");
    showTooltip(text, event.clientX, event.clientY);
  });
}

function getColors(type) {
  const accent = TYPE_META[type]?.accent || fallbackColor(type);
  return [DEFAULT_COLORS[0], DEFAULT_COLORS[1], DEFAULT_COLORS[2], DEFAULT_COLORS[3], accent];
}

function displayType(type) {
  return TYPE_META[type]?.label || prettifyType(type);
}

function summaryTypeTitle(type) {
  const label = displayType(type);
  const normalized = label.trim().toLowerCase();
  if (normalized === "ride") {
    return "Rides";
  }
  if (normalized === "run") {
    return "Runs";
  }
  if (normalized === "weight training") {
    return "Weight Trainings";
  }
  return label;
}

function formatActivitiesTitle(types) {
  if (!types || !types.length) {
    return "Activities";
  }
  return `${types.map((type) => displayType(type)).join(" + ")} Activities`;
}

function fallbackColor(type) {
  if (!type) return FALLBACK_VAPORWAVE[0];
  let index = 0;
  for (let i = 0; i < type.length; i += 1) {
    index += (i + 1) * type.charCodeAt(i);
  }
  return FALLBACK_VAPORWAVE[index % FALLBACK_VAPORWAVE.length];
}

function prettifyType(type) {
  return String(type || "Other")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function formatNumber(value, fractionDigits) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(value);
}

function formatDistance(meters, units) {
  if (units.distance === "km") {
    return `${formatNumber(meters / 1000, 1)} km`;
  }
  return `${formatNumber(meters / 1609.344, 1)} mi`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

function formatElevation(meters, units) {
  if (units.elevation === "m") {
    return `${formatNumber(Math.round(meters), 0)} m`;
  }
  return `${formatNumber(Math.round(meters * 3.28084), 0)} ft`;
}

function formatHourLabel(hour) {
  const suffix = hour < 12 ? "a" : "p";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${suffix}`;
}

function buildSummary(payload, types, years, showTypeBreakdown, showActiveDays, hideDistanceElevation, onTypeCardSelect) {
  summary.innerHTML = "";

  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
  };
  const typeTotals = {};
  const activeDays = new Set();

  Object.entries(payload.aggregates || {}).forEach(([year, yearData]) => {
    if (!years.includes(Number(year))) return;
    Object.entries(yearData || {}).forEach(([type, entries]) => {
      if (!types.includes(type)) return;
      if (!typeTotals[type]) {
        typeTotals[type] = { count: 0 };
      }
      Object.entries(entries || {}).forEach(([dateStr, entry]) => {
        if ((entry.count || 0) > 0) {
          activeDays.add(dateStr);
        }
        totals.count += entry.count || 0;
        totals.distance += entry.distance || 0;
        totals.moving_time += entry.moving_time || 0;
        totals.elevation += entry.elevation_gain || 0;
        typeTotals[type].count += entry.count || 0;
      });
    });
  });

  const cards = [
    { title: "Total Activities", value: totals.count.toLocaleString() },
  ];
  if (!hideDistanceElevation) {
    cards.push({
      title: "Total Distance",
      value: formatDistance(totals.distance, payload.units || { distance: "mi" }),
    });
    cards.push({
      title: "Total Elevation",
      value: formatElevation(totals.elevation, payload.units || { elevation: "ft" }),
    });
  }
  cards.push({ title: "Total Time", value: formatDuration(totals.moving_time) });
  if (showActiveDays) {
    cards.push({ title: "Active Days", value: activeDays.size.toLocaleString() });
  }

  cards.forEach((card) => {
    const el = document.createElement("div");
    el.className = "summary-card";
    const title = document.createElement("div");
    title.className = "summary-title";
    title.textContent = card.title;
    const value = document.createElement("div");
    value.className = "summary-value";
    value.textContent = card.value;
    el.appendChild(title);
    el.appendChild(value);
    summary.appendChild(el);
  });

  if (showTypeBreakdown) {
    types.forEach((type) => {
      const typeCard = document.createElement("button");
      typeCard.type = "button";
      typeCard.className = "summary-card summary-card-action";
      typeCard.title = `Filter: ${displayType(type)}`;
      const title = document.createElement("div");
      title.className = "summary-title";
      title.textContent = summaryTypeTitle(type);
      const value = document.createElement("div");
      value.className = "summary-type";
      const dot = document.createElement("span");
      dot.className = "summary-dot";
      dot.style.background = getColors(type)[4];
      const text = document.createElement("span");
      text.textContent = (typeTotals[type]?.count || 0).toLocaleString();
      value.appendChild(dot);
      value.appendChild(text);
      typeCard.appendChild(title);
      typeCard.appendChild(value);
      if (onTypeCardSelect) {
        typeCard.addEventListener("click", () => onTypeCardSelect(type));
      }
      summary.appendChild(typeCard);
    });
  }
}

function buildHeatmapArea(aggregates, year, units, colors, type, layout, options = {}) {
  const heatmapArea = document.createElement("div");
  heatmapArea.className = "heatmap-area";

  const monthRow = document.createElement("div");
  monthRow.className = "month-row";
  monthRow.style.paddingLeft = `${layout.gridPadLeft}px`;
  heatmapArea.appendChild(monthRow);

  const dayCol = document.createElement("div");
  dayCol.className = "day-col";
  dayCol.style.paddingTop = `${layout.gridPadTop}px`;
  dayCol.style.gap = `${layout.gap}px`;
  DAYS.forEach((label) => {
    const dayLabel = document.createElement("div");
    dayLabel.className = "day-label";
    dayLabel.textContent = label;
    dayLabel.style.height = `${layout.cell}px`;
    dayLabel.style.lineHeight = `${layout.cell}px`;
    dayCol.appendChild(dayLabel);
  });
  heatmapArea.appendChild(dayCol);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const start = sundayOnOrBefore(yearStart);
  const end = saturdayOnOrAfter(yearEnd);

  for (let month = 0; month < 12; month += 1) {
    const monthStart = new Date(year, month, 1);
    const weekIndex = Math.floor((monthStart - start) / (1000 * 60 * 60 * 24 * 7));
    const monthLabel = document.createElement("div");
    monthLabel.className = "month-label";
    monthLabel.textContent = MONTHS[month];
    monthLabel.style.left = `${weekIndex * (layout.cell + layout.gap)}px`;
    monthRow.appendChild(monthLabel);
  }

  const grid = document.createElement("div");
  grid.className = "grid";

  for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const dateStr = formatLocalDateKey(day);
    const inYear = day.getFullYear() === year;
    const entry = (aggregates && aggregates[dateStr]) || {
      count: 0,
      distance: 0,
      moving_time: 0,
      elevation_gain: 0,
      activity_ids: [],
    };

    const weekIndex = Math.floor((day - start) / (1000 * 60 * 60 * 24 * 7));
    const row = day.getDay(); // Sunday=0

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.gridColumn = weekIndex + 1;
    cell.style.gridRow = row + 1;

    if (!inYear) {
      cell.classList.add("outside");
      grid.appendChild(cell);
      continue;
    }

    const filled = (entry.count || 0) > 0;
    if (filled && typeof options.colorForEntry === "function") {
      cell.style.background = options.colorForEntry(entry);
    } else {
      cell.style.background = filled ? colors[4] : colors[0];
    }

    const durationMinutes = Math.round((entry.moving_time || 0) / 60);
    const duration = durationMinutes >= 60
      ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
      : `${durationMinutes}m`;

    const lines = [
      dateStr,
      `${entry.count} ${entry.count === 1 ? "activity" : "activities"}`,
    ];

    const showDistanceElevation = (entry.distance || 0) > 0 || (entry.elevation_gain || 0) > 0;

    if (type === "all" && entry.types && entry.types.length) {
      lines.push(`Types: ${entry.types.map(displayType).join(", ")}`);
    }

    if (showDistanceElevation) {
      const distance = units.distance === "km"
        ? `${(entry.distance / 1000).toFixed(2)} km`
        : `${(entry.distance / 1609.344).toFixed(2)} mi`;
      const elevation = units.elevation === "m"
        ? `${Math.round(entry.elevation_gain)} m`
        : `${Math.round(entry.elevation_gain * 3.28084)} ft`;
      lines.push(`Distance: ${distance}`);
      lines.push(`Elevation: ${elevation}`);
    }

    lines.push(`Duration: ${duration}`);
    const tooltipText = lines.join("\n");
    if (!isTouch) {
      cell.addEventListener("mouseenter", (event) => {
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener("mousemove", (event) => {
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
      cell.addEventListener("mouseleave", hideTooltip);
    } else {
      cell.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        event.preventDefault();
        if (cell.classList.contains("active")) {
          cell.classList.remove("active");
          hideTooltip();
          return;
        }
        const active = grid.querySelector(".cell.active");
        if (active) active.classList.remove("active");
        cell.classList.add("active");
        showTooltip(tooltipText, event.clientX, event.clientY);
      });
    }

    grid.appendChild(cell);
  }

  heatmapArea.appendChild(grid);
  return heatmapArea;
}

function buildCard(type, year, aggregates, units, options = {}) {
  const card = document.createElement("div");
  card.className = "card year-card";

  const body = document.createElement("div");
  body.className = "card-body";

  const colors = type === "all" ? DEFAULT_COLORS : getColors(type);
  const layout = getLayout();
  const heatmapArea = buildHeatmapArea(aggregates, year, units, colors, type, layout, options);
  body.appendChild(heatmapArea);

  const stats = document.createElement("div");
  stats.className = "card-stats side-stats-column";
  const totals = {
    count: 0,
    distance: 0,
    moving_time: 0,
    elevation: 0,
  };
  Object.entries(aggregates || {}).forEach(([, entry]) => {
    totals.count += entry.count || 0;
    totals.distance += entry.distance || 0;
    totals.moving_time += entry.moving_time || 0;
    totals.elevation += entry.elevation_gain || 0;
  });

  const statItems = [
    { label: "Total Activities", value: totals.count.toLocaleString() },
    { label: "Total Time", value: formatDuration(totals.moving_time) },
  ];

  const hideDistanceElevation = totals.distance <= 0 && totals.elevation <= 0;
  if (!hideDistanceElevation) {
    statItems.splice(1, 0, {
      label: "Total Distance",
      value: formatDistance(totals.distance, units || { distance: "mi" }),
    });
    statItems.push({
      label: "Total Elevation",
      value: formatElevation(totals.elevation, units || { elevation: "ft" }),
    });
  }

  statItems.forEach((item) => {
    const stat = document.createElement("div");
    stat.className = "card-stat";
    const label = document.createElement("div");
    label.className = "card-stat-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "card-stat-value";
    value.textContent = item.value;
    stat.appendChild(label);
    stat.appendChild(value);
    stats.appendChild(stat);
  });

  body.appendChild(stats);
  card.appendChild(body);
  return card;
}

function buildEmptyYearCard(type, year, labelOverride) {
  const card = document.createElement("div");
  card.className = "card card-empty-year";

  const placeholder = document.createElement("div");
  placeholder.className = "year-empty-placeholder";

  const ellipsis = document.createElement("span");
  ellipsis.className = "year-empty-ellipsis";
  ellipsis.textContent = "\u22ee";
  placeholder.appendChild(ellipsis);

  const message = document.createElement("span");
  message.className = "year-empty-message";
  const label = labelOverride || displayType(type);
  message.textContent = `no ${String(label).toLowerCase()} activities`;
  placeholder.appendChild(message);

  card.appendChild(placeholder);
  return card;
}

function buildLabeledCardRow(label, card, kind) {
  const row = document.createElement("div");
  row.className = "labeled-card-row";
  if (kind) {
    row.classList.add(`labeled-card-row-${kind}`);
  }
  if (card?.classList?.contains("card")) {
    card.classList.add("card-with-labeled-title");
  }

  const title = document.createElement("div");
  title.className = "card-title labeled-card-title";
  title.textContent = label;

  card.insertBefore(title, card.firstChild);
  row.appendChild(card);
  return row;
}

function combineYearAggregates(yearData, types) {
  const combined = {};
  types.forEach((type) => {
    const entries = yearData?.[type] || {};
    Object.entries(entries).forEach(([dateStr, entry]) => {
      if (!combined[dateStr]) {
        combined[dateStr] = {
          count: 0,
          distance: 0,
          moving_time: 0,
          elevation_gain: 0,
          types: new Set(),
        };
      }
      combined[dateStr].count += entry.count || 0;
      combined[dateStr].distance += entry.distance || 0;
      combined[dateStr].moving_time += entry.moving_time || 0;
      combined[dateStr].elevation_gain += entry.elevation_gain || 0;
      if ((entry.count || 0) > 0) {
        combined[dateStr].types.add(type);
      }
    });
  });

  const result = {};
  Object.entries(combined).forEach(([dateStr, entry]) => {
    result[dateStr] = {
      count: entry.count,
      distance: entry.distance,
      moving_time: entry.moving_time,
      elevation_gain: entry.elevation_gain,
      types: Array.from(entry.types),
    };
  });
  return result;
}

function combineAggregatesByDate(payload, types, years) {
  const combined = {};
  years.forEach((year) => {
    const yearData = payload.aggregates?.[String(year)] || {};
    types.forEach((type) => {
      const entries = yearData?.[type] || {};
      Object.entries(entries).forEach(([dateStr, entry]) => {
        if (!combined[dateStr]) {
          combined[dateStr] = {
            count: 0,
            distance: 0,
            moving_time: 0,
            elevation_gain: 0,
          };
        }
        combined[dateStr].count += entry.count || 0;
        combined[dateStr].distance += entry.distance || 0;
        combined[dateStr].moving_time += entry.moving_time || 0;
        combined[dateStr].elevation_gain += entry.elevation_gain || 0;
      });
    });
  });
  return combined;
}

function getFilteredActivities(payload, types, years) {
  const activities = payload.activities || [];
  if (!activities.length) return [];
  const yearSet = new Set(years.map(Number));
  const typeSet = new Set(types);
  return activities.filter((activity) => (
    typeSet.has(activity.type) && yearSet.has(Number(activity.year))
  ));
}

function shouldHideDistanceElevation(payload, types, years) {
  for (const year of years) {
    const yearData = payload.aggregates?.[String(year)] || {};
    for (const type of types) {
      const entries = yearData?.[type] || {};
      for (const entry of Object.values(entries)) {
        if ((entry.distance || 0) > 0 || (entry.elevation_gain || 0) > 0) {
          return false;
        }
      }
    }
  }
  return true;
}

function getTypeYearTotals(payload, type, years) {
  const totals = new Map();
  years.forEach((year) => {
    const entries = payload.aggregates?.[String(year)]?.[type] || {};
    let total = 0;
    Object.values(entries).forEach((entry) => {
      total += entry.count || 0;
    });
    totals.set(year, total);
  });
  return totals;
}

function getTypesYearTotals(payload, types, years) {
  if (types.length === 1) {
    return getTypeYearTotals(payload, types[0], years);
  }
  const totals = new Map();
  years.forEach((year) => {
    const yearData = payload.aggregates?.[String(year)] || {};
    let total = 0;
    types.forEach((type) => {
      Object.values(yearData?.[type] || {}).forEach((entry) => {
        total += entry.count || 0;
      });
    });
    totals.set(year, total);
  });
  return totals;
}

function trimOldestEmptyYears(years, yearTotals) {
  if (!years.length) return [];
  const yearsAsc = years.slice().sort((a, b) => a - b);
  let firstActiveYear = null;
  yearsAsc.forEach((year) => {
    if (firstActiveYear !== null) return;
    if ((yearTotals.get(year) || 0) > 0) {
      firstActiveYear = year;
    }
  });

  if (firstActiveYear === null) {
    return [years[0]];
  }

  return years.filter((year) => year >= firstActiveYear);
}

function getVisibleYearsForTypes(payload, types, years, showAllYears) {
  const sortedYears = years.slice().sort((a, b) => b - a);
  if (showAllYears) {
    return sortedYears;
  }
  if (!types.length) {
    return sortedYears;
  }
  const yearTotals = getTypesYearTotals(payload, types, sortedYears);
  return trimOldestEmptyYears(sortedYears, yearTotals);
}

function getFrequencyColor(types, allYearsSelected) {
  if (types.length === 1) {
    return getColors(types[0])[4];
  }
  if (allYearsSelected) {
    return MULTI_TYPE_COLOR;
  }
  return types.length ? getColors(types[0])[4] : MULTI_TYPE_COLOR;
}

function buildStatRow() {
  const row = document.createElement("div");
  row.className = "card stats-row";
  return row;
}

function buildStatPanel(title, subtitle) {
  const panel = document.createElement("div");
  panel.className = "stat-panel";
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "card-title";
    titleEl.textContent = title;
    panel.appendChild(titleEl);
  }
  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "stat-subtitle";
    subtitleEl.textContent = subtitle;
    panel.appendChild(subtitleEl);
  }
  const body = document.createElement("div");
  body.className = "stat-body";
  panel.appendChild(body);
  return { panel, body };
}

function buildStatsOverview(payload, types, years, color) {
  const card = document.createElement("div");
  card.className = "card more-stats";

  const body = document.createElement("div");
  body.className = "more-stats-body";

  const graphs = document.createElement("div");
  graphs.className = "more-stats-grid";
  const facts = document.createElement("div");
  facts.className = "more-stats-facts side-stats-column";

  const yearsDesc = years.slice().sort((a, b) => b - a);
  const emptyColor = DEFAULT_COLORS[0];

  const dayMatrix = yearsDesc.map(() => new Array(7).fill(0));
  const dayBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 7 }, () => ({}))
  ));
  const monthMatrix = yearsDesc.map(() => new Array(12).fill(0));
  const monthBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 12 }, () => ({}))
  ));
  const weekTotals = new Array(54).fill(0);

  yearsDesc.forEach((year, row) => {
    types.forEach((type) => {
      const entries = payload.aggregates?.[String(year)]?.[type] || {};
      Object.entries(entries).forEach(([dateStr, entry]) => {
        const count = entry.count || 0;
        if (count <= 0) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const dayIndex = date.getDay();
        const monthIndex = date.getMonth();
        const weekIndex = weekOfYear(date);
        dayMatrix[row][dayIndex] += count;
        monthMatrix[row][monthIndex] += count;
        if (weekIndex >= 1 && weekIndex < weekTotals.length) {
          weekTotals[weekIndex] += count;
        }
        const dayBucket = dayBreakdowns[row][dayIndex];
        const monthBucket = monthBreakdowns[row][monthIndex];
        dayBucket[type] = (dayBucket[type] || 0) + count;
        monthBucket[type] = (monthBucket[type] || 0) + count;
      });
    });
  });

  const formatBreakdown = (total, breakdown) => {
    const lines = [`Total: ${total} ${total === 1 ? "activity" : "activities"}`];
    if (types.length > 1) {
      types.forEach((type) => {
        const count = breakdown[type] || 0;
        if (count > 0) {
          lines.push(`${displayType(type)}: ${count}`);
        }
      });
    }
    return lines.join("\n");
  };

  const dayDisplayLabels = ["Sun", "", "", "Wed", "", "", "Sat"];
  const monthDisplayLabels = ["Jan", "", "Mar", "", "May", "", "Jul", "", "Sep", "", "Nov", ""];

  const dayPanel = buildStatPanel("");
  dayPanel.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      dayDisplayLabels,
      dayMatrix,
      color,
      {
        rotateLabels: false,
        tooltipLabels: DAYS,
        cssScope: card,
        emptyColor,
        tooltipFormatter: (year, label, value, row, col) => {
          const breakdown = dayBreakdowns[row][col] || {};
          return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
        },
      },
    ),
  );

  const monthPanel = buildStatPanel("");
  monthPanel.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      monthDisplayLabels,
      monthMatrix,
      color,
      {
        rotateLabels: false,
        tooltipLabels: MONTHS,
        cssScope: card,
        emptyColor,
        tooltipFormatter: (year, label, value, row, col) => {
          const breakdown = monthBreakdowns[row][col] || {};
          return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
        },
      },
    ),
  );

  const hourMatrix = yearsDesc.map(() => new Array(24).fill(0));
  const hourBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 24 }, () => ({}))
  ));
  const activities = getFilteredActivities(payload, types, yearsDesc);
  const yearIndex = new Map();
  yearsDesc.forEach((year, index) => {
    yearIndex.set(Number(year), index);
  });
  activities.forEach((activity) => {
    const row = yearIndex.get(Number(activity.year));
    if (row === undefined) return;
    const hour = Number(activity.hour);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
    hourMatrix[row][hour] += 1;
    const bucket = hourBreakdowns[row][hour];
    const type = activity.type;
    bucket[type] = (bucket[type] || 0) + 1;
  });

  const hourTotals = hourMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(24).fill(0),
  );
  const hourLabels = hourTotals.map((_, hour) => (hour % 3 === 0 ? formatHourLabel(hour) : ""));
  const hourTooltipLabels = hourTotals.map((_, hour) => `${formatHourLabel(hour)} (${hour}:00)`);

  const hourPanel = buildStatPanel("");
  if (activities.length) {
    hourPanel.body.appendChild(
      buildYearMatrix(
        yearsDesc,
        hourLabels,
        hourMatrix,
        color,
        {
          tooltipLabels: hourTooltipLabels,
          cssScope: card,
          emptyColor,
          tooltipFormatter: (year, label, value, row, col) => {
            const breakdown = hourBreakdowns[row][col] || {};
            return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
          },
        },
      ),
    );
  } else {
    const fallback = document.createElement("div");
    fallback.className = "stat-subtitle";
    fallback.textContent = "Time-of-day stats require activity timestamps.";
    hourPanel.body.appendChild(fallback);
  }
  const dayTotals = dayMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(7).fill(0),
  );
  const bestDayIndex = dayTotals.reduce((best, value, index) => (
    value > dayTotals[best] ? index : best
  ), 0);
  const bestDayLabel = `${DAYS[bestDayIndex]} (${dayTotals[bestDayIndex]})`;

  const monthTotals = monthMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(12).fill(0),
  );
  const bestMonthIndex = monthTotals.reduce((best, value, index) => (
    value > monthTotals[best] ? index : best
  ), 0);
  const bestMonthLabel = `${MONTHS[bestMonthIndex]} (${monthTotals[bestMonthIndex]})`;

  const bestHourIndex = hourTotals.reduce((best, value, index) => (
    value > hourTotals[best] ? index : best
  ), 0);
  const bestHourLabel = activities.length
    ? `${formatHourLabel(bestHourIndex)} (${hourTotals[bestHourIndex]})`
    : "Not enough time data yet";

  const bestWeekIndex = weekTotals.reduce((best, value, index) => (
    index === 0 ? best : (value > weekTotals[best] ? index : best)
  ), 1);
  const bestWeekCount = weekTotals[bestWeekIndex] || 0;
  const bestWeekLabel = bestWeekCount > 0
    ? `Week ${bestWeekIndex} (${bestWeekCount})`
    : "Not enough data yet";

  const graphColumns = [
    { panel: dayPanel.panel, label: "Most active day", value: bestDayLabel },
    { panel: monthPanel.panel, label: "Most Active Month", value: bestMonthLabel },
    { panel: hourPanel.panel, label: "Peak hour", value: bestHourLabel },
  ];

  graphColumns.forEach((item) => {
    const col = document.createElement("div");
    col.className = "more-stats-col";
    col.appendChild(item.panel);
    graphs.appendChild(col);
  });

  const factItems = [
    { key: "most-active-day", label: "Most active day", value: bestDayLabel },
    { key: "most-active-month", label: "Most Active Month", value: bestMonthLabel },
    { key: "peak-hour", label: "Peak hour", value: bestHourLabel },
    { key: "most-active-week", label: "Most active week", value: bestWeekLabel },
  ];

  factItems.forEach((item) => {
    const factCard = document.createElement("div");
    factCard.className = "card-stat more-stats-fact-card";
    if (item.key) {
      factCard.classList.add(`fact-${item.key}`);
    }
    const label = document.createElement("div");
    label.className = "card-stat-label";
    label.textContent = item.label;
    const value = document.createElement("div");
    value.className = "card-stat-value";
    value.textContent = item.value;
    factCard.appendChild(label);
    factCard.appendChild(value);
    facts.appendChild(factCard);
  });

  body.appendChild(graphs);
  card.appendChild(body);
  card.appendChild(facts);
  return card;
}

function buildFactBox(text) {
  const box = document.createElement("div");
  box.className = "stat-fact";
  const label = document.createElement("div");
  label.className = "stat-fact-label";
  label.textContent = "Highlight";
  const value = document.createElement("div");
  value.className = "stat-fact-value";
  value.textContent = text;
  box.appendChild(label);
  box.appendChild(value);
  return box;
}

function buildYearMatrix(years, colLabels, matrixValues, color, options = {}) {
  const container = document.createElement("div");
  container.className = "stat-matrix";
  if (!years.length || !colLabels.length) {
    return container;
  }

  const matrixArea = document.createElement("div");
  matrixArea.className = "axis-matrix-area";
  matrixArea.style.gridTemplateColumns = "var(--axis-width) max-content";
  matrixArea.style.gridTemplateRows = "var(--label-row-height) auto";
  matrixArea.style.columnGap = "var(--axis-gap)";

  const monthRow = document.createElement("div");
  monthRow.className = "axis-month-row";
  monthRow.style.paddingLeft = "var(--grid-pad-left)";

  const dayCol = document.createElement("div");
  dayCol.className = "axis-day-col";
  dayCol.style.paddingTop = "var(--grid-pad-top)";
  dayCol.style.gap = "var(--gap)";

  years.forEach((year) => {
    const yLabel = document.createElement("div");
    yLabel.className = "day-label axis-y-label";
    yLabel.textContent = String(year);
    yLabel.style.height = "var(--cell)";
    yLabel.style.lineHeight = "var(--cell)";
    dayCol.appendChild(yLabel);
  });

  const grid = document.createElement("div");
  grid.className = "axis-matrix-grid";
  grid.style.gridTemplateColumns = `repeat(${colLabels.length}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${years.length}, var(--cell))`;
  grid.style.gap = "var(--gap)";
  grid.style.padding = "var(--grid-pad-top) var(--grid-pad-right) var(--grid-pad-bottom) var(--grid-pad-left)";

  const max = matrixValues.reduce(
    (acc, row) => Math.max(acc, ...row),
    0,
  );
  const tooltipLabels = options.tooltipLabels || colLabels;

  colLabels.forEach((label, colIndex) => {
    if (!label) return;
    const xLabel = document.createElement("div");
    xLabel.className = "month-label axis-x-label";
    xLabel.textContent = label;
    xLabel.style.left = `calc(${colIndex} * (var(--cell) + var(--gap)))`;
    if (options.rotateLabels) {
      xLabel.classList.add("diagonal");
    }
    monthRow.appendChild(xLabel);
  });

  years.forEach((year, row) => {
    colLabels.forEach((_, col) => {
      const cell = document.createElement("div");
      cell.className = "cell axis-matrix-cell";
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(col + 1);
      const value = matrixValues[row]?.[col] || 0;
      if (options.emptyColor && value <= 0) {
        cell.style.background = options.emptyColor;
      } else {
        cell.style.background = heatColor(color, value, max);
      }
      if (options.tooltipFormatter) {
        const label = tooltipLabels[col];
        const tooltipText = options.tooltipFormatter(year, label, value, row, col);
        attachTooltip(cell, tooltipText);
      }
      grid.appendChild(cell);
    });
  });

  matrixArea.appendChild(monthRow);
  matrixArea.appendChild(dayCol);
  matrixArea.appendChild(grid);
  container.appendChild(matrixArea);
  return container;
}

function calculateStreaks(activeDates) {
  if (!activeDates.length) {
    return { longest: 0, latest: 0 };
  }
  const sorted = activeDates.slice().sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`);
    const curr = new Date(`${sorted[i]}T00:00:00`);
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current += 1;
    } else {
      longest = Math.max(longest, current);
      current = 1;
    }
  }
  longest = Math.max(longest, current);
  return { longest, latest: current };
}

function renderStats(payload, types, years, color) {
  if (!stats) return;
  stats.innerHTML = "";

  const yearsDesc = years.slice().sort((a, b) => b - a);
  const yearIndex = new Map();
  yearsDesc.forEach((year, index) => {
    yearIndex.set(Number(year), index);
  });

  const dayMatrix = yearsDesc.map(() => new Array(7).fill(0));
  const dayBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 7 }, () => ({}))
  ));
  const monthMatrix = yearsDesc.map(() => new Array(12).fill(0));
  const monthBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 12 }, () => ({}))
  ));

  yearsDesc.forEach((year, row) => {
    types.forEach((type) => {
      const entries = payload.aggregates?.[String(year)]?.[type] || {};
      Object.entries(entries).forEach(([dateStr, entry]) => {
        const count = entry.count || 0;
        if (count <= 0) return;
        const date = new Date(`${dateStr}T00:00:00`);
        const dayIndex = date.getDay();
        const monthIndex = date.getMonth();
        dayMatrix[row][dayIndex] += count;
        monthMatrix[row][monthIndex] += count;
        const dayBucket = dayBreakdowns[row][dayIndex];
        const monthBucket = monthBreakdowns[row][monthIndex];
        dayBucket[type] = (dayBucket[type] || 0) + count;
        monthBucket[type] = (monthBucket[type] || 0) + count;
      });
    });
  });
  const dayTotals = dayMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(7).fill(0),
  );
  const bestDayIndex = dayTotals.reduce((best, value, index) => (
    value > dayTotals[best] ? index : best
  ), 0);
  const bestDayLabel = `${DAYS[bestDayIndex]} (${dayTotals[bestDayIndex]} ${dayTotals[bestDayIndex] === 1 ? "activity" : "activities"})`;

  const formatBreakdown = (total, breakdown) => {
    const lines = [`Total: ${total} ${total === 1 ? "activity" : "activities"}`];
    types.forEach((type) => {
      const count = breakdown[type] || 0;
      if (count > 0) {
        lines.push(`${displayType(type)}: ${count}`);
      }
    });
    return lines.join("\n");
  };

  const row1 = buildStatRow();
  const dayPanel = buildStatPanel("Activity Frequency by Day of Week");
  dayPanel.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      DAYS,
      dayMatrix,
      color,
      {
        rotateLabels: true,
        alignFirstChar: true,
        tooltipFormatter: (year, label, value, row, col) => {
          const breakdown = dayBreakdowns[row][col] || {};
          return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
        },
      },
    ),
  );
  row1.appendChild(dayPanel.panel);
  row1.appendChild(buildFactBox(`Most active: ${bestDayLabel}`));
  stats.appendChild(row1);
  const monthTotals = monthMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(12).fill(0),
  );
  const bestMonthIndex = monthTotals.reduce((best, value, index) => (
    value > monthTotals[best] ? index : best
  ), 0);
  const bestMonthLabel = `${MONTHS[bestMonthIndex]} (${monthTotals[bestMonthIndex]} ${monthTotals[bestMonthIndex] === 1 ? "activity" : "activities"})`;

  const row2 = buildStatRow();
  const monthPanel = buildStatPanel("Activity Frequency by Month");
  monthPanel.body.appendChild(
    buildYearMatrix(
      yearsDesc,
      MONTHS,
      monthMatrix,
      color,
      {
        rotateLabels: true,
        alignFirstChar: true,
        tooltipFormatter: (year, label, value, row, col) => {
          const breakdown = monthBreakdowns[row][col] || {};
          return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
        },
      },
    ),
  );
  row2.appendChild(monthPanel.panel);
  row2.appendChild(buildFactBox(`Busiest month: ${bestMonthLabel}`));
  stats.appendChild(row2);

  const hourMatrix = yearsDesc.map(() => new Array(24).fill(0));
  const hourBreakdowns = yearsDesc.map(() => (
    Array.from({ length: 24 }, () => ({}))
  ));
  const activities = getFilteredActivities(payload, types, yearsDesc);
  activities.forEach((activity) => {
    const row = yearIndex.get(Number(activity.year));
    if (row === undefined) return;
    const hour = Number(activity.hour);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      hourMatrix[row][hour] += 1;
      const bucket = hourBreakdowns[row][hour];
      const type = activity.type;
      bucket[type] = (bucket[type] || 0) + 1;
    }
  });

  const hourTotals = hourMatrix.reduce(
    (acc, row) => row.map((value, index) => acc[index] + value),
    new Array(24).fill(0),
  );
  const bestHourIndex = hourTotals.reduce((best, value, index) => (
    value > hourTotals[best] ? index : best
  ), 0);
  const hourLabels = hourTotals.map((_, hour) => (hour % 3 === 0 ? formatHourLabel(hour) : ""));
  const hourTooltipLabels = hourTotals.map((_, hour) => `${formatHourLabel(hour)} (${hour}:00)`);
  const hourSubtitle = activities.length
    ? `Peak hour: ${formatHourLabel(bestHourIndex)} (${hourTotals[bestHourIndex]} ${hourTotals[bestHourIndex] === 1 ? "activity" : "activities"})`
    : "Peak hour: not enough time data yet";

  const row3 = buildStatRow();
  const hourPanel = buildStatPanel("Activity Frequency by Time of Day");
  if (activities.length) {
    hourPanel.body.appendChild(
      buildYearMatrix(
        yearsDesc,
        hourLabels,
        hourMatrix,
        color,
        {
          tooltipLabels: hourTooltipLabels,
          tooltipFormatter: (year, label, value, row, col) => {
            const breakdown = hourBreakdowns[row][col] || {};
            return `${year} · ${label}\n${formatBreakdown(value, breakdown)}`;
          },
        },
      ),
    );
  } else {
    const fallback = document.createElement("div");
    fallback.className = "stat-subtitle";
    fallback.textContent = "Time-of-day stats require activity timestamps.";
    hourPanel.body.appendChild(fallback);
  }
  row3.appendChild(hourPanel.panel);
  row3.appendChild(buildFactBox(hourSubtitle));
  stats.appendChild(row3);
}

async function init() {
  syncRepoLink();
  const resp = await fetch("data.json");
  const payload = await resp.json();
  TYPE_META = payload.type_meta || {};
  (payload.types || []).forEach((type) => {
    if (!TYPE_META[type]) {
      TYPE_META[type] = { label: prettifyType(type), accent: fallbackColor(type) };
    }
  });

  if (payload.generated_at) {
    const updatedAt = new Date(payload.generated_at);
    if (!Number.isNaN(updatedAt.getTime())) {
      updated.textContent = `Last updated: ${updatedAt.toLocaleString([], {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
  }

  const typeOptions = [
    { value: "all", label: "All Activities" },
    ...payload.types.map((type) => ({ value: type, label: displayType(type) })),
  ];

  function renderButtons(container, options, onSelect) {
    if (!container) return;
    container.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.dataset.value = option.value;
      button.textContent = option.label;
      button.addEventListener("click", () => onSelect(option.value));
      container.appendChild(button);
    });
  }

  function renderMenuOptions(container, options, selectedValues, isAllSelected, onSelect, normalizeValue) {
    if (!container) return;
    container.innerHTML = "";
    options.forEach((option) => {
      const rawValue = String(option.value);
      const normalized = normalizeValue ? normalizeValue(rawValue) : rawValue;
      const isActive = rawValue === "all"
        ? isAllSelected
        : (!isAllSelected && selectedValues.has(normalized));

      const row = document.createElement("button");
      row.type = "button";
      row.className = "filter-menu-option";
      if (isActive) {
        row.classList.add("active");
      }
      row.dataset.value = rawValue;

      const label = document.createElement("span");
      label.className = "filter-menu-option-label";
      label.textContent = option.label;

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "filter-menu-check";
      check.checked = isActive;
      check.tabIndex = -1;
      check.setAttribute("aria-hidden", "true");

      row.appendChild(label);
      row.appendChild(check);
      row.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      row.addEventListener("click", () => onSelect(rawValue));
      container.appendChild(row);
    });
  }

  function renderMenuDoneButton(container, onDone) {
    if (!container) return;
    const done = document.createElement("button");
    done.type = "button";
    done.className = "filter-menu-done";
    done.textContent = "Done";
    done.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    done.addEventListener("click", () => onDone());
    container.appendChild(done);
  }

  let resizeTimer = null;

  let allTypesMode = true;
  let selectedTypes = new Set();
  let allYearsMode = true;
  let selectedYears = new Set();
  let currentVisibleYears = payload.years.slice().sort((a, b) => b - a);

  function areAllTypesSelected() {
    return allTypesMode;
  }

  function areAllYearsSelected() {
    return allYearsMode;
  }

  function selectedTypesList() {
    if (areAllTypesSelected()) {
      return payload.types.slice();
    }
    return payload.types.filter((type) => selectedTypes.has(type));
  }

  function selectedYearsList(visibleYears) {
    if (areAllYearsSelected()) {
      return visibleYears.slice();
    }
    return visibleYears.filter((year) => selectedYears.has(Number(year)));
  }

  function updateButtonState(container, selectedValues, isAllSelected, normalizeValue) {
    if (!container) return;
    container.querySelectorAll(".filter-button").forEach((button) => {
      const rawValue = String(button.dataset.value || "");
      const value = normalizeValue ? normalizeValue(rawValue) : rawValue;
      const isActive = rawValue === "all"
        ? isAllSelected
        : (!isAllSelected && selectedValues.has(value));
      button.classList.toggle("active", isActive);
    });
  }

  function toggleType(value) {
    if (value === "all") {
      allTypesMode = true;
      selectedTypes.clear();
      return;
    }
    if (!payload.types.includes(value)) return;
    if (allTypesMode) {
      allTypesMode = false;
      selectedTypes = new Set([value]);
      return;
    }
    if (selectedTypes.has(value)) {
      selectedTypes.delete(value);
      if (!selectedTypes.size) {
        allTypesMode = true;
      }
      return;
    }
    selectedTypes.add(value);
  }

  function toggleYear(value) {
    if (value === "all") {
      allYearsMode = true;
      selectedYears.clear();
      return;
    }
    const year = Number(value);
    if (!Number.isFinite(year) || !currentVisibleYears.includes(year)) return;
    if (allYearsMode) {
      allYearsMode = false;
      selectedYears = new Set([year]);
      return;
    }
    if (selectedYears.has(year)) {
      selectedYears.delete(year);
      if (!selectedYears.size) {
        allYearsMode = true;
      }
      return;
    }
    selectedYears.add(year);
  }

  function getTypeMenuText(types, allTypesSelected) {
    if (allTypesSelected) return "All Activities";
    if (types.length > 1) return "Multiple Activities Selected";
    if (types.length === 1) return `${displayType(types[0])} Activities`;
    return "All Activities";
  }

  function getYearMenuText(years, allYearsSelected) {
    if (allYearsSelected) return "All Years";
    if (years.length > 1) return "Multiple Years Selected";
    if (years.length === 1) return String(years[0]);
    return "All Years";
  }

  function setMenuLabel(labelEl, text) {
    if (!labelEl) return;
    labelEl.textContent = text;
  }

  function setMenuOpen(menuEl, buttonEl, isOpen) {
    if (!menuEl) return;
    menuEl.classList.toggle("open", isOpen);
    if (buttonEl) {
      buttonEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function update(options = {}) {
    const keepTypeMenuOpen = Boolean(options.keepTypeMenuOpen);
    const keepYearMenuOpen = Boolean(options.keepYearMenuOpen);
    const allTypesSelected = areAllTypesSelected();
    const types = selectedTypesList();
    const visibleYears = getVisibleYearsForTypes(payload, types, payload.years, allTypesSelected);
    currentVisibleYears = visibleYears.slice();
    if (!areAllYearsSelected()) {
      const visibleSet = new Set(visibleYears.map(Number));
      Array.from(selectedYears).forEach((year) => {
        if (!visibleSet.has(Number(year))) {
          selectedYears.delete(year);
        }
      });
      if (!selectedYears.size) {
        allYearsMode = true;
      }
    }
    const allYearsSelected = areAllYearsSelected();
    const yearOptions = [
      { value: "all", label: "All Years" },
      ...visibleYears.map((year) => ({ value: String(year), label: String(year) })),
    ];
    renderButtons(yearButtons, yearOptions, (value) => {
      toggleYear(value);
      update();
    });
    renderMenuOptions(
      typeMenuOptions,
      typeOptions,
      selectedTypes,
      allTypesSelected,
      (value) => {
        toggleType(value);
        update({ keepTypeMenuOpen: true });
      },
    );
    renderMenuDoneButton(typeMenuOptions, () => {
      setMenuOpen(typeMenu, typeMenuButton, false);
    });
    renderMenuOptions(
      yearMenuOptions,
      yearOptions,
      selectedYears,
      allYearsSelected,
      (value) => {
        toggleYear(value);
        update({ keepYearMenuOpen: true });
      },
      (v) => Number(v),
    );
    renderMenuDoneButton(yearMenuOptions, () => {
      setMenuOpen(yearMenu, yearMenuButton, false);
    });
    const years = selectedYearsList(visibleYears);
    if (!years.length) {
      allYearsMode = true;
      selectedYears.clear();
      years.push(...visibleYears);
    }
    years.sort((a, b) => b - a);
    const frequencyColor = getFrequencyColor(types, allYearsSelected);
    const showCombinedTypes = types.length > 1;
    const allAvailableTypesSelected = types.length === payload.types.length;

    updateButtonState(typeButtons, selectedTypes, allTypesSelected);
    updateButtonState(yearButtons, selectedYears, allYearsSelected, (v) => Number(v));
    setMenuLabel(typeMenuLabel, getTypeMenuText(types, allTypesSelected));
    setMenuLabel(yearMenuLabel, getYearMenuText(years, allYearsSelected));
    if (typeClearButton) {
      typeClearButton.disabled = areAllTypesSelected();
    }
    if (yearClearButton) {
      yearClearButton.disabled = areAllYearsSelected();
    }
    if (keepTypeMenuOpen) {
      setMenuOpen(typeMenu, typeMenuButton, true);
    }
    if (keepYearMenuOpen) {
      setMenuOpen(yearMenu, yearMenuButton, true);
    }

    if (heatmaps) {
      heatmaps.innerHTML = "";
      const showMoreStats = allYearsSelected;
      if (showCombinedTypes) {
        const section = document.createElement("div");
        section.className = "type-section";
        const header = document.createElement("div");
        header.className = "type-header";
        header.textContent = allAvailableTypesSelected ? "All Activities" : formatActivitiesTitle(types);
        section.appendChild(header);
        const list = document.createElement("div");
        list.className = "type-list";
        const yearTotals = getTypesYearTotals(payload, types, years);
        const cardYears = allYearsSelected
          ? trimOldestEmptyYears(years, yearTotals)
          : years.slice();
        const emptyLabel = types.map((type) => displayType(type)).join(" + ");
        if (showMoreStats) {
          list.appendChild(
            buildLabeledCardRow(
              "Activity Frequency",
              buildStatsOverview(payload, types, cardYears, frequencyColor),
              "frequency",
            ),
          );
        }
        cardYears.forEach((year) => {
          const yearData = payload.aggregates?.[String(year)] || {};
          const aggregates = combineYearAggregates(yearData, types);
          const total = yearTotals.get(year) || 0;
          const colorForEntry = (entry) => {
            if (!entry.types || entry.types.length === 0) {
              return DEFAULT_COLORS[0];
            }
            if (entry.types.length === 1) {
              return getColors(entry.types[0])[4];
            }
            return MULTI_TYPE_COLOR;
          };
          const card = total > 0
            ? buildCard(
              "all",
              year,
              aggregates,
              payload.units || { distance: "mi", elevation: "ft" },
              { colorForEntry },
            )
            : buildEmptyYearCard("all", year, emptyLabel);
          list.appendChild(buildLabeledCardRow(String(year), card, "year"));
        });
        section.appendChild(list);
        heatmaps.appendChild(section);
      } else {
        types.forEach((type) => {
          const section = document.createElement("div");
          section.className = "type-section";
          const header = document.createElement("div");
          header.className = "type-header";
          header.textContent = formatActivitiesTitle([type]);
          section.appendChild(header);

          const list = document.createElement("div");
          list.className = "type-list";
          const yearTotals = getTypeYearTotals(payload, type, years);
          const cardYears = allYearsSelected
            ? trimOldestEmptyYears(years, yearTotals)
            : years.slice();
          if (showMoreStats) {
            list.appendChild(
              buildLabeledCardRow(
                "Activity Frequency",
                buildStatsOverview(payload, [type], cardYears, frequencyColor),
                "frequency",
              ),
            );
          }
          cardYears.forEach((year) => {
            const aggregates = payload.aggregates?.[String(year)]?.[type] || {};
            const total = yearTotals.get(year) || 0;
            const card = total > 0
              ? buildCard(type, year, aggregates, payload.units || { distance: "mi", elevation: "ft" })
              : buildEmptyYearCard(type, year);
            list.appendChild(buildLabeledCardRow(String(year), card, "year"));
          });
          if (!list.childElementCount) {
            return;
          }
          section.appendChild(list);
          heatmaps.appendChild(section);
        });
      }
    }

    renderStats(payload, types, years, frequencyColor);

    const showTypeBreakdown = types.length > 1;
    const showActiveDays = types.length > 1 && Boolean(heatmaps);
    const hideDistanceElevation = shouldHideDistanceElevation(payload, types, years);
    buildSummary(
      payload,
      types,
      years,
      showTypeBreakdown,
      showActiveDays,
      hideDistanceElevation,
      (type) => {
        toggleType(type);
        update();
      },
    );
    requestAnimationFrame(alignStackedStatsToYAxisLabels);
  }

  renderButtons(typeButtons, typeOptions, (value) => {
    toggleType(value);
    update();
  });
  if (typeMenuButton) {
    typeMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !typeMenu?.classList.contains("open");
      setMenuOpen(typeMenu, typeMenuButton, open);
      setMenuOpen(yearMenu, yearMenuButton, false);
    });
  }
  if (yearMenuButton) {
    yearMenuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !yearMenu?.classList.contains("open");
      setMenuOpen(yearMenu, yearMenuButton, open);
      setMenuOpen(typeMenu, typeMenuButton, false);
    });
  }
  if (typeClearButton) {
    typeClearButton.addEventListener("click", () => {
      if (areAllTypesSelected()) return;
      allTypesMode = true;
      selectedTypes.clear();
      update();
    });
  }
  if (yearClearButton) {
    yearClearButton.addEventListener("click", () => {
      if (areAllYearsSelected()) return;
      allYearsMode = true;
      selectedYears.clear();
      update();
    });
  }

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (typeMenu && !typeMenu.contains(target)) {
      setMenuOpen(typeMenu, typeMenuButton, false);
    }
    if (yearMenu && !yearMenu.contains(target)) {
      setMenuOpen(yearMenu, yearMenuButton, false);
    }
  });
  update();

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      alignStackedStatsToYAxisLabels();
    }).catch(() => {});
  }

  window.addEventListener("resize", () => {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      update();
    }, 150);
  });

  if (isTouch) {
    document.addEventListener("pointerdown", (event) => {
      if (!tooltip.classList.contains("visible")) return;
      const target = event.target;
      if (tooltip.contains(target)) {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
        return;
      }
      if (!target.classList.contains("cell")) {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
      }
    });

    window.addEventListener(
      "scroll",
      () => {
        hideTooltip();
        const active = document.querySelector(".cell.active");
        if (active) active.classList.remove("active");
      },
      { passive: true },
    );
  }
}

init().catch((error) => {
  console.error(error);
});
