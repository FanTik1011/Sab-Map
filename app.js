const bounds = {
  xMin: -430000,
  xMax: -30000,
  yMin: 260000,
  yMax: 555000
};

const tileConfig = {
  enabled: true,
  url: "https://subnautica2.gg/tiles/{z}/{x}/{y}.webp",
  minZoom: 8,
  maxZoom: 15,
  sourceZoom: 15,
  tileSize: 256,
  canvasGlobalPixelOrigin: { x: 4161536, y: 4161536 },
  worldBounds: {
    xMin: -430000,
    yMin: 259999.66666666666
  },
  fullScale: 0.12,
  maskBBox: { x: 6164, y: 13433 },
  imageScale: 0.9446494464944649,
  imageOffset: { x: 0, y: 8987 }
};

const fallbackBuckets = [
  {
    id: "locations",
    title: "Locations",
    color: "#f5be7a",
    symbol: "◆",
    visible: true,
    categories: [
      ["welcome_center", "Welcome Center", 1],
      ["camp_one", "Camp One", 1],
      ["lifepod", "Lifepod", 1],
      ["old_habitat", "Old Habitat", 1],
      ["wu_lianghai", "Wu Lianghai", 1],
      ["cave", "Cave", 42],
      ["blackbox", "Blackbox", 31],
      ["supply_crate", "Supply Crate", 35],
      ["data_box", "Data Box", 25],
      ["quartz_chip", "Quartz Chip", 47],
      ["biohacking_chamber", "Biohacking Chamber", 7]
    ]
  },
  {
    id: "resources",
    title: "Resources",
    color: "#76f5ec",
    symbol: "●",
    visible: false,
    categories: [
      ["atacamite", "Atacamite", 28],
      ["celestine", "Celestine", 173],
      ["copper", "Copper", 735],
      ["gold", "Gold", 224],
      ["lead", "Lead", 129],
      ["lithium", "Lithium", 75],
      ["quartz", "Quartz", 1285],
      ["salt", "Salt", 505],
      ["silver", "Silver", 685],
      ["sulfur", "Sulfur", 517],
      ["titanium", "Titanium", 4969],
      ["troilite", "Troilite", 8],
      ["other_resources", "Other Resources", 154]
    ]
  },
  {
    id: "blueprints",
    title: "Blueprints",
    color: "#8fb4ff",
    symbol: "▣",
    visible: false,
    categories: [
      ["builder_tool", "Builder Tool", 1],
      ["beacon", "Beacon", 9],
      ["biobed", "Biobed", 5],
      ["bioreactor", "Bioreactor", 7],
      ["dive_elevator", "Dive Elevator", 10],
      ["habitat_builder", "Habitat Builder", 14],
      ["moonpool", "Moonpool", 18],
      ["scanner_station", "Scanner Station", 1],
      ["thermal_plant", "Thermal Plant", 8],
      ["tadpole", "Tadpole", 14],
      ["wakemaker", "Wakemaker", 15],
      ["work_light", "Work Light", 8],
      ["other_blueprints", "Other Blueprints", 311]
    ]
  },
  {
    id: "creatures",
    title: "Creatures",
    color: "#9aff8f",
    symbol: "✦",
    visible: false,
    categories: [
      ["acid_raion", "Acid Raion", 220],
      ["bluemon", "Bluemoon", 183],
      ["branching_coral", "Branching Coral", 366],
      ["collector_leviathan", "Collector Leviathan", 4],
      ["curtain_gorgon", "Curtain Gorgon", 697],
      ["feather_kelp", "Feather Kelp", 304],
      ["geordie", "Geordie", 148],
      ["halfmoon", "Halfmoon", 906],
      ["hoverthorn", "Hoverthorn", 201],
      ["jack_sponge", "Jack Sponge", 3745],
      ["jelly_lei", "Jelly Lei", 162],
      ["pebbled_sporal", "Pebbled Sporal", 312],
      ["titan_rockbore", "Titan Rockbore", 921],
      ["water_slug", "Water Slug", 1173],
      ["whip_gorgon", "Whip Gorgon", 253],
      ["wort_wort", "Wort Wort", 151],
      ["other_creatures", "Other Creatures", 2594]
    ]
  }
];

const buckets = window.SN2_DATA?.buckets || fallbackBuckets;
const bucketSymbols = {
  locations: "◆",
  resources: "●",
  blueprints: "▣",
  creatures: "✦"
};
const imageCache = new Map();

const canvas = document.querySelector("#mapCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const bucketList = document.querySelector("#bucketList");
const searchInput = document.querySelector("#searchInput");
const visibleCount = document.querySelector("#visibleCount");
const popup = document.querySelector("#popup");
const page = document.querySelector(".map-page");
const coordX = document.querySelector("#coordX");
const coordY = document.querySelector("#coordY");
const positionReadout = document.querySelector("#positionReadout");

let dpr = 1;
let view = { x: 0, y: 0, scale: 1 };
let minScale = 0.001;
let isDragging = false;
let dragStart = null;
let selectedMarker = null;
let hoveredMarker = null;
let playerPosition = null;
let allMarkers = [];
let visibleMarkers = [];
let categoryIndex = new Map();
let drawQueued = false;
let isInteracting = false;
let interactionTimer = null;
const tileCache = new Map();

function scheduleDraw() {
  if (drawQueued) return;
  drawQueued = true;
  window.requestAnimationFrame(() => {
    drawQueued = false;
    draw();
  });
}

function beginInteraction() {
  isInteracting = true;
  if (interactionTimer) window.clearTimeout(interactionTimer);
}

function endInteraction(delay = 120) {
  if (interactionTimer) window.clearTimeout(interactionTimer);
  interactionTimer = window.setTimeout(() => {
    isInteracting = false;
    scheduleDraw();
  }, delay);
}

function hashSeed(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mapSize() {
  if (tileConfig.enabled) {
    const extent = mapPixelExtent();
    return {
      width: extent.maxX - extent.minX,
      height: extent.maxY - extent.minY
    };
  }
  return {
    width: bounds.xMax - bounds.xMin,
    height: bounds.yMax - bounds.yMin
  };
}

function worldToScreen(x, y) {
  const size = mapSize();
  if (tileConfig.enabled) {
    const extent = mapPixelExtent();
    const pixel = worldToSourcePixel(x, y);
    return {
      x: view.x + (pixel.x - extent.minX) * view.scale,
      y: view.y + (pixel.y - extent.minY) * view.scale
    };
  }
  const nx = (x - bounds.xMin) / size.width;
  const ny = (bounds.yMax - y) / size.height;
  return {
    x: view.x + nx * size.width * view.scale,
    y: view.y + ny * size.height * view.scale
  };
}

function screenToWorld(x, y) {
  const size = mapSize();
  if (tileConfig.enabled) {
    const extent = mapPixelExtent();
    const pixel = {
      x: extent.minX + (x - view.x) / view.scale,
      y: extent.minY + (y - view.y) / view.scale
    };
    return sourcePixelToWorld(pixel.x, pixel.y);
  }
  const nx = (x - view.x) / (size.width * view.scale);
  const ny = (y - view.y) / (size.height * view.scale);
  return {
    x: bounds.xMin + nx * size.width,
    y: bounds.yMax - ny * size.height
  };
}

function worldToSourcePixel(x, y) {
  const cfg = tileConfig;
  const canvasX = (x - cfg.worldBounds.xMin) * cfg.fullScale;
  const canvasY = (y - cfg.worldBounds.yMin) * cfg.fullScale;
  const imageX = (canvasX - cfg.maskBBox.x) * cfg.imageScale + cfg.imageOffset.x;
  const imageY = (canvasY - cfg.maskBBox.y) * cfg.imageScale + cfg.imageOffset.y;
  return {
    x: cfg.canvasGlobalPixelOrigin.x + imageX,
    y: cfg.canvasGlobalPixelOrigin.y + imageY
  };
}

function sourcePixelToWorld(pixelX, pixelY) {
  const cfg = tileConfig;
  const imageX = pixelX - cfg.canvasGlobalPixelOrigin.x;
  const imageY = pixelY - cfg.canvasGlobalPixelOrigin.y;
  const canvasX = (imageX - cfg.imageOffset.x) / cfg.imageScale + cfg.maskBBox.x;
  const canvasY = (imageY - cfg.imageOffset.y) / cfg.imageScale + cfg.maskBBox.y;
  return {
    x: canvasX / cfg.fullScale + cfg.worldBounds.xMin,
    y: canvasY / cfg.fullScale + cfg.worldBounds.yMin
  };
}

function mapPixelExtent() {
  const corners = [
    worldToSourcePixel(bounds.xMin, bounds.yMin),
    worldToSourcePixel(bounds.xMax, bounds.yMin),
    worldToSourcePixel(bounds.xMax, bounds.yMax),
    worldToSourcePixel(bounds.xMin, bounds.yMax)
  ];
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y))
  };
}

function assetUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `icons${path}`;
}

function getCachedImage(path, size = 30) {
  if (!path) return null;
  const url = assetUrl(path, size);
  if (imageCache.has(url)) return imageCache.get(url);
  const image = new Image();
  const entry = { image, loaded: false, failed: false };
  image.onload = () => {
    entry.loaded = true;
    scheduleDraw();
  };
  image.onerror = () => {
    entry.failed = true;
  };
  image.src = url;
  imageCache.set(url, entry);
  return entry;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.round(number).toLocaleString("en-US");
}

function bearingToCardinal(bearing) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((Math.round(Number(bearing)) % 360) + 360) % 360;
  return labels[Math.floor((normalized + 22.5) / 45) % 8] || "";
}

function currentNav(marker) {
  if (!playerPosition) return null;
  const dx = marker.x - playerPosition.x;
  const dy = marker.y - playerPosition.y;
  return {
    bearing: ((Math.round(Math.atan2(dx, -dy) * 180 / Math.PI) % 360) + 360) % 360,
    distance: Math.round(Math.hypot(dx, dy) / 100)
  };
}

function generateMarkers() {
  const markers = [];
  buckets.forEach((bucket) => {
    bucket.symbol = bucket.symbol || bucketSymbols[bucket.id] || "•";
    bucket.visible = bucket.visible ?? bucket.id === "locations";
    bucket.categories = bucket.categories.map((rawCategory) => {
      if (Array.isArray(rawCategory)) {
        const [id, title, count] = rawCategory;
        return {
          id,
          key: `${bucket.id}__${id}`,
          title,
          iconPath: "",
          count,
          visible: bucket.visible,
          markers: null
        };
      }
      return {
        ...rawCategory,
        key: `${bucket.id}__${rawCategory.id}`,
        count: rawCategory.markers?.length || 0,
        visible: bucket.visible
      };
    });

    bucket.categories.forEach((category) => {
      categoryIndex.set(category.key, category);
      if (category.markers) {
        category.markers.forEach((marker, index) => {
          markers.push({
            id: marker.id || `${category.key}_${index + 1}`,
            title: marker.title || category.title,
            description: marker.description || marker.detail || "",
            detail: marker.detail || marker.description || "",
            image: marker.image || "",
            bucketId: bucket.id,
            bucketTitle: bucket.title,
            categoryKey: category.key,
            categoryTitle: category.title,
            color: bucket.color,
            bucketColor: bucket.color,
            symbol: bucket.symbol,
            iconPath: marker.physicalIconPath || marker.iconPath || category.iconPath || "",
            categoryIconPath: category.iconPath || "",
            x: marker.x,
            y: marker.y,
            lat: marker.lat,
            lng: marker.lng,
            nav: marker.nav || null,
            unlockItems: marker.unlockItems || null
          });
        });
        return;
      }

      const random = rng(hashSeed(category.key));
      const clusters = Math.max(1, Math.min(12, Math.ceil(Math.sqrt(category.count) / 3)));
      const centers = Array.from({ length: clusters }, (_, index) => {
        const ring = (index + 1) / (clusters + 1);
        const angle = random() * Math.PI * 2;
        const wobble = 0.15 + random() * 0.55;
        return {
          x: bounds.xMin + (0.5 + Math.cos(angle) * ring * wobble * 0.45 + (random() - 0.5) * 0.18) * (bounds.xMax - bounds.xMin),
          y: bounds.yMin + (0.5 + Math.sin(angle) * ring * wobble * 0.45 + (random() - 0.5) * 0.18) * (bounds.yMax - bounds.yMin)
        };
      });

      for (let i = 0; i < category.count; i += 1) {
        const center = centers[i % centers.length];
        const spread = bucket.id === "locations" ? 9000 : bucket.id === "blueprints" ? 18000 : 32000;
        const x = Math.max(bounds.xMin, Math.min(bounds.xMax, center.x + (random() - 0.5) * spread));
        const y = Math.max(bounds.yMin, Math.min(bounds.yMax, center.y + (random() - 0.5) * spread));
        markers.push({
          id: `${category.key}_${i + 1}`,
          title: category.count === 1 ? category.title : `${category.title} ${i + 1}`,
          bucketId: bucket.id,
          bucketTitle: bucket.title,
          categoryKey: category.key,
          categoryTitle: category.title,
          color: bucket.color,
          bucketColor: bucket.color,
          symbol: bucket.symbol,
          iconPath: category.iconPath || "",
          categoryIconPath: category.iconPath || "",
          x,
          y
        });
      }
    });
  });
  allMarkers = markers;
}

function categoryVisible(key) {
  return categoryIndex.get(key)?.visible || false;
}

function refreshVisibleMarkers() {
  visibleMarkers = allMarkers.filter((marker) => categoryVisible(marker.categoryKey));
  visibleCount.textContent = visibleMarkers.length.toLocaleString("en-US");
}

function renderSidebar() {
  const query = searchInput.value.trim().toLowerCase();
  bucketList.innerHTML = "";

  buckets.forEach((bucket) => {
    const filtered = bucket.categories.filter((category) => {
      return !query || category.title.toLowerCase().includes(query) || bucket.title.toLowerCase().includes(query);
    });
    if (!filtered.length) return;

    const section = document.createElement("section");
    section.className = "bucket";

    const enabled = filtered.filter((category) => category.visible).length;
    const total = filtered.reduce((sum, category) => sum + category.count, 0);
    const head = document.createElement("label");
    head.className = "bucket-title";
    head.innerHTML = `
      <input class="check" type="checkbox" ${enabled === filtered.length ? "checked" : ""}>
      <h2>${bucket.title}</h2>
      <span class="bucket-count">${total.toLocaleString("en-US")}</span>
    `;
    const bucketCheck = head.querySelector("input");
    bucketCheck.indeterminate = enabled > 0 && enabled < filtered.length;
    bucketCheck.addEventListener("change", () => {
      filtered.forEach((category) => {
        category.visible = bucketCheck.checked;
      });
      update();
    });
    section.append(head);

    filtered.forEach((category) => {
      const row = document.createElement("label");
      row.className = `category ${category.visible ? "is-on" : ""}`;
      row.style.setProperty("--cat-color", bucket.color);
      const iconHtml = category.iconPath
        ? `<img src="${assetUrl(category.iconPath, 30)}" alt="" loading="lazy">`
        : bucket.symbol;
      row.innerHTML = `
        <input class="check" type="checkbox" ${category.visible ? "checked" : ""}>
        <span class="cat-icon">${iconHtml}</span>
        <span class="cat-title">${category.title}</span>
        <span class="cat-count">${category.count.toLocaleString("en-US")}</span>
      `;
      row.querySelector("input").addEventListener("change", (event) => {
        category.visible = event.target.checked;
        update();
      });
      section.append(row);
    });

    bucketList.append(section);
  });
}

function drawMapBackground() {
  ctx.fillStyle = "#03101a";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  if (tileConfig.enabled) {
    drawTiles();
    return;
  }

  const size = mapSize();
  const topLeft = worldToScreen(bounds.xMin, bounds.yMax);
  const bottomRight = worldToScreen(bounds.xMax, bounds.yMin);
  const w = bottomRight.x - topLeft.x;
  const h = bottomRight.y - topLeft.y;

  const gradient = ctx.createRadialGradient(topLeft.x + w * 0.45, topLeft.y + h * 0.42, w * 0.05, topLeft.x + w * 0.5, topLeft.y + h * 0.5, w * 0.72);
  gradient.addColorStop(0, "#1b7f95");
  gradient.addColorStop(0.34, "#0a536d");
  gradient.addColorStop(0.64, "#062f49");
  gradient.addColorStop(1, "#04172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(topLeft.x, topLeft.y, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(topLeft.x, topLeft.y, w, h);
  ctx.clip();

  for (let i = 0; i < 22; i += 1) {
    const random = rng(9000 + i);
    const cx = topLeft.x + random() * w;
    const cy = topLeft.y + random() * h;
    const radius = (0.06 + random() * 0.16) * Math.min(w, h);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * (0.8 + random()), radius * (0.35 + random() * 0.6), random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = i % 3 === 0 ? "rgba(118, 245, 236, 0.08)" : i % 3 === 1 ? "rgba(245, 190, 122, 0.06)" : "rgba(19, 120, 159, 0.14)";
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(118, 245, 236, 0.16)";
  ctx.lineWidth = Math.max(1, 1.1 * view.scale);
  for (let i = 0; i < 28; i += 1) {
    const random = rng(12000 + i);
    ctx.beginPath();
    for (let step = 0; step <= 70; step += 1) {
      const t = step / 70;
      const x = topLeft.x + t * w;
      const y = topLeft.y + (0.18 + random() * 0.64) * h + Math.sin(t * 7 + random() * 8) * h * (0.02 + random() * 0.035);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const gridStep = 50000;
  ctx.strokeStyle = "rgba(217, 238, 244, 0.08)";
  ctx.lineWidth = 1;
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillStyle = "rgba(217, 238, 244, 0.45)";

  for (let x = Math.ceil(bounds.xMin / gridStep) * gridStep; x <= bounds.xMax; x += gridStep) {
    const p1 = worldToScreen(x, bounds.yMin);
    const p2 = worldToScreen(x, bounds.yMax);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    if (p2.x > -80 && p2.x < canvas.width / dpr + 20) ctx.fillText(String(x), p2.x + 5, topLeft.y + 18);
  }

  for (let y = Math.ceil(bounds.yMin / gridStep) * gridStep; y <= bounds.yMax; y += gridStep) {
    const p1 = worldToScreen(bounds.xMin, y);
    const p2 = worldToScreen(bounds.xMax, y);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    if (p1.y > -20 && p1.y < canvas.height / dpr + 20) ctx.fillText(String(y), topLeft.x + 10, p1.y - 5);
  }

  ctx.strokeStyle = "rgba(245, 190, 122, 0.34)";
  ctx.lineWidth = 2;
  ctx.strokeRect(topLeft.x, topLeft.y, size.width * view.scale, size.height * view.scale);
  ctx.restore();
}

function chooseTileZoom() {
  const desired = tileConfig.sourceZoom + Math.log2(Math.max(0.0001, view.scale));
  return Math.max(tileConfig.minZoom, Math.min(tileConfig.maxZoom, Math.round(desired + 2)));
}

function tileUrl(z, x, y) {
  return tileConfig.url
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

function getTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const image = new Image();
  const entry = { image, loaded: false, failed: false };
  image.onload = () => {
    entry.loaded = true;
    scheduleDraw();
  };
  image.onerror = () => {
    entry.failed = true;
  };
  image.src = tileUrl(z, x, y);
  tileCache.set(key, entry);
  return entry;
}

function drawTiles() {
  if (!tileConfig.enabled) return false;
  const extent = mapPixelExtent();
  const z = chooseTileZoom();
  const factor = 2 ** (tileConfig.sourceZoom - z);
  const tileSpan = tileConfig.tileSize * factor;
  const viewWidth = canvas.width / dpr;
  const viewHeight = canvas.height / dpr;
  const overscan = 256;
  const corners = [
    { x: -overscan, y: -overscan },
    { x: viewWidth + overscan, y: -overscan },
    { x: viewWidth + overscan, y: viewHeight + overscan },
    { x: -overscan, y: viewHeight + overscan }
  ].map((point) => ({
    x: extent.minX + (point.x - view.x) / view.scale,
    y: extent.minY + (point.y - view.y) / view.scale
  }));
  const visibleMinX = Math.min(...corners.map((point) => point.x));
  const visibleMinY = Math.min(...corners.map((point) => point.y));
  const visibleMaxX = Math.max(...corners.map((point) => point.x));
  const visibleMaxY = Math.max(...corners.map((point) => point.y));
  const startX = Math.max(0, Math.floor(visibleMinX / tileSpan) - 1);
  const endX = Math.ceil(visibleMaxX / tileSpan) + 1;
  const startY = Math.max(0, Math.floor(visibleMinY / tileSpan) - 1);
  const endY = Math.ceil(visibleMaxY / tileSpan) + 1;
  let loadedTiles = 0;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  for (let tx = startX; tx <= endX; tx += 1) {
    for (let ty = startY; ty <= endY; ty += 1) {
      if (tx < 0 || ty < 0) continue;
      const tile = getTile(z, tx, ty);
      if (!tile.loaded || tile.failed) continue;
      const sourceX = tx * tileSpan;
      const sourceY = ty * tileSpan;
      const screenX = view.x + (sourceX - extent.minX) * view.scale;
      const screenY = view.y + (sourceY - extent.minY) * view.scale;
      const screenSize = tileSpan * view.scale;
      ctx.drawImage(tile.image, screenX, screenY, screenSize, screenSize);
      loadedTiles += 1;
    }
  }
  ctx.restore();
  return loadedTiles > 0;
}

function drawMarker(marker, isSelected = false, lightweight = false) {
  const point = worldToScreen(marker.x, marker.y);
  if (point.x < -55 || point.y < -70 || point.x > canvas.width / dpr + 55 || point.y > canvas.height / dpr + 70) return;
  const closeZoom = view.scale > 0.025;
  const radius = isSelected
    ? 18
    : marker.bucketId === "locations"
      ? closeZoom ? 13 : 9
      : closeZoom ? 11 : 8;
  const shouldDrawIcon = !lightweight || visibleMarkers.length < 350;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = lightweight ? 0 : isSelected ? 18 : 8;
  ctx.beginPath();
  ctx.moveTo(0, radius * 1.72);
  ctx.bezierCurveTo(radius + 8, -2, radius, -radius - 8, 0, -radius - 8);
  ctx.bezierCurveTo(-radius, -radius - 8, -radius - 8, -2, 0, radius * 1.72);
  ctx.closePath();
  ctx.fillStyle = marker.color;
  ctx.fill();
  ctx.lineWidth = Math.max(2.4, radius * 0.2);
  ctx.strokeStyle = "#061426";
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#dce7ee";
  ctx.beginPath();
  ctx.arc(0, -2, radius * 0.66, 0, Math.PI * 2);
  ctx.fill();
  const icon = shouldDrawIcon ? getCachedImage(marker.iconPath, 54) : null;
  if (icon?.loaded && !icon.failed) {
    const iconSize = radius * 1.32;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -2, radius * 0.66, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(icon.image, -iconSize / 2, -2 - iconSize / 2, iconSize, iconSize);
    ctx.restore();
  } else {
    ctx.fillStyle = marker.color;
    ctx.font = `${Math.max(9, radius)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marker.symbol, 0, -2);
  }
  ctx.restore();
}

function drawIconBadge(marker, point, isSelected = false) {
  const icon = getCachedImage(marker.iconPath || marker.categoryIconPath, 54);
  const radius = isSelected ? 18 : 15;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.shadowColor = marker.color;
  ctx.shadowBlur = isSelected ? 18 : 8;

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(232, 244, 238, 0.9)";
  ctx.fill();
  ctx.lineWidth = isSelected ? 3 : 2;
  ctx.strokeStyle = marker.color;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-5, radius - 2);
  ctx.lineTo(0, radius + 8);
  ctx.lineTo(5, radius - 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(232, 244, 238, 0.9)";
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  if (icon?.loaded && !icon.failed) {
    const iconSize = radius * 1.62;
    ctx.drawImage(icon.image, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
  } else {
    ctx.fillStyle = marker.color;
    ctx.font = `900 ${radius}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marker.symbol, 0, 1);
  }

  ctx.restore();
}

function drawCluster(cluster) {
  const radius = Math.max(10, Math.min(25, 8 + Math.log10(cluster.count) * 8));
  ctx.save();
  ctx.translate(cluster.x, cluster.y);
  ctx.shadowColor = cluster.color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = cluster.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#06101d";
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#06101d";
  ctx.font = `800 ${radius > 18 ? 11 : 10}px Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(cluster.count > 999 ? `${Math.round(cluster.count / 100) / 10}k` : String(cluster.count), 0, 0);
  ctx.restore();
}

function drawVisibleMarkers() {
  const selectedId = selectedMarker?.id;
  const lightweight = isInteracting || visibleMarkers.length > 4500;
  if (visibleMarkers.length < 2500) {
    visibleMarkers.forEach((marker) => {
      if (marker.bucketId !== "locations") drawMarker(marker, selectedId === marker.id, lightweight);
    });
    visibleMarkers.forEach((marker) => {
      if (marker.bucketId === "locations") drawMarker(marker, selectedId === marker.id, lightweight);
    });
    return;
  }

  const cells = new Map();
  const cellSize = isInteracting ? 72 : view.scale < 0.025 ? 58 : 46;
  for (const marker of visibleMarkers) {
    const point = worldToScreen(marker.x, marker.y);
    if (point.x < -40 || point.y < -50 || point.x > canvas.width / dpr + 40 || point.y > canvas.height / dpr + 50) continue;
    if (marker.id === selectedId) {
      drawMarker(marker, true, lightweight);
      continue;
    }
    const key = `${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}:${marker.bucketId}`;
    const existing = cells.get(key);
    if (existing) {
      existing.x += point.x;
      existing.y += point.y;
      existing.count += 1;
    } else {
      cells.set(key, {
        x: point.x,
        y: point.y,
        count: 1,
        color: marker.color,
        sample: marker
      });
    }
  }

  for (const cluster of cells.values()) {
    cluster.x /= cluster.count;
    cluster.y /= cluster.count;
    if (cluster.count === 1) drawMarker(cluster.sample, false, lightweight);
    else drawCluster(cluster);
  }
}

function drawPlayer() {
  if (!playerPosition) return;
  const point = worldToScreen(playerPosition.x, playerPosition.y);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = "#76f5ec";
  ctx.fillStyle = "rgba(118, 245, 236, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#76f5ec";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHoverTooltip() {
  if (!hoveredMarker || hoveredMarker.id === selectedMarker?.id) return;
  const point = worldToScreen(hoveredMarker.x, hoveredMarker.y);
  const text = hoveredMarker.title;
  ctx.font = "600 12px Inter, sans-serif";
  const padX = 10;
  const boxWidth = ctx.measureText(text).width + padX * 2;
  const boxHeight = 26;
  const x = point.x - boxWidth / 2;
  const y = point.y - 46;
  ctx.save();
  ctx.fillStyle = "rgba(7, 14, 26, 0.94)";
  ctx.strokeStyle = "rgba(125, 99, 255, 0.55)";
  ctx.lineWidth = 1;
  const radius = 6;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + boxWidth, y, x + boxWidth, y + boxHeight, radius);
  ctx.arcTo(x + boxWidth, y + boxHeight, x, y + boxHeight, radius);
  ctx.arcTo(x, y + boxHeight, x, y, radius);
  ctx.arcTo(x, y, x + boxWidth, y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f3f0ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, point.x, y + boxHeight / 2);
  ctx.restore();
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMapBackground();
  drawVisibleMarkers();
  drawPlayer();
  drawHoverTooltip();
  positionPopup();
}

function update() {
  refreshVisibleMarkers();
  renderSidebar();
  hoveredMarker = null;
  scheduleDraw();
}

function fitView() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const size = mapSize();
  const scale = Math.min(width / size.width, height / size.height) * 0.92;
  minScale = scale * 0.6;
  view.scale = scale;
  view.x = (width - size.width * scale) / 2;
  view.y = (height - size.height * scale) / 2;
}

let resizeFrame = null;
function resize() {
  dpr = Math.max(1, Math.min(1.35, window.devicePixelRatio || 1));
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  fitView();
  scheduleDraw();
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    resize();
  });
}

function zoomAt(screenX, screenY, factor) {
  const before = screenToWorld(screenX, screenY);
  view.scale = Math.max(minScale, Math.min(0.5, view.scale * factor));
  const after = worldToScreen(before.x, before.y);
  view.x += screenX - after.x;
  view.y += screenY - after.y;
  scheduleDraw();
}

function findMarker(screenX, screenY) {
  let best = null;
  let bestDistance = 18;
  for (let i = visibleMarkers.length - 1; i >= 0; i -= 1) {
    const marker = visibleMarkers[i];
    const point = worldToScreen(marker.x, marker.y);
    const distance = Math.hypot(point.x - screenX, point.y - screenY);
    if (distance < bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
}

function showPopup(marker) {
  selectedMarker = marker;
  popup.hidden = false;
  popup.style.setProperty("--pop-color", marker.color);
  popup.classList.remove("is-open");
  const popupArt = marker.iconPath
    ? `<img src="${assetUrl(marker.iconPath, 150)}" alt="">`
    : marker.symbol;
  const details = marker.detail
    ? String(marker.detail).split(/\r?\n/).filter(Boolean).map((line) => `<span class="pop-detail-line">${escapeHtml(line)}</span>`).join("")
    : "";
  const unlocks = Array.isArray(marker.unlockItems) && marker.unlockItems.length
    ? `<div class="pop-unlocks"><span class="pop-unlocks-label">Unlocks</span>${marker.unlockItems.map((item) => `
        <span class="pop-unlock-row">
          ${item.iconPath ? `<img src="${assetUrl(item.iconPath, 28)}" alt="">` : `<span class="pop-unlock-empty"></span>`}
          <span>${escapeHtml(item.name || "Blueprint")}</span>
        </span>
      `).join("")}</div>`
    : "";
  const lifepodNav = marker.nav
    ? renderNavBlock("From Lifepod", marker.nav.bearing, marker.nav.distance, marker.nav.depth, "lifepod")
    : "";
  const playerNav = currentNav(marker);
  const playerNavBlock = playerNav
    ? renderNavBlock("From your position", playerNav.bearing, playerNav.distance, null, "current")
    : "";
  const detailHtml = details ? `<span class="pop-detail">${details}</span>` : "";
  popup.innerHTML = `
    <div class="art">${popupArt}</div>
    <div class="body">
      <small>${escapeHtml(marker.bucketTitle)} / ${escapeHtml(marker.categoryTitle)}</small>
      <strong>${escapeHtml(marker.title)}</strong>
      ${unlocks}
      ${detailHtml}
    </div>
    ${lifepodNav}
    ${playerNavBlock}
  `;
  window.requestAnimationFrame(() => popup.classList.add("is-open"));
  scheduleDraw();
}

function renderNavBlock(label, bearing, distance, depth, mode) {
  const cleanBearing = Math.round(Number(bearing));
  if (!Number.isFinite(cleanBearing)) return "";
  const rows = [
    `<span class="pop-nav-row"><b>${bearingToCardinal(cleanBearing)} ${cleanBearing}&deg;</b><span>face this on compass</span></span>`
  ];
  if (distance != null) {
    rows.push(`<span class="pop-nav-row"><b>${compactNumber(distance)} m</b><span>${mode === "current" ? "from your position" : "swim this far from Lifepod"}</span></span>`);
  }
  if (depth != null) {
    rows.push(`<span class="pop-nav-row"><b>Depth ${compactNumber(depth)} m</b><span>target depth</span></span>`);
  }
  return `
    <div class="pop-nav ${mode === "current" ? "is-current" : "is-lifepod"}">
      <span class="pop-nav-label">${escapeHtml(label)}</span>
      <span class="pop-nav-rows">${rows.join("")}</span>
    </div>
  `;
}

function hidePopup() {
  selectedMarker = null;
  popup.hidden = true;
  scheduleDraw();
}

function positionPopup() {
  if (!selectedMarker || popup.hidden) return;
  const point = worldToScreen(selectedMarker.x, selectedMarker.y);
  popup.style.left = `${point.x}px`;
  popup.style.top = `${point.y}px`;
}

function parseCoord(value) {
  const match = String(value).match(/[-+]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function setPlayerPosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    positionReadout.innerHTML = `<span style="color: var(--danger)">Enter one X and one Y value.</span>`;
    return;
  }
  playerPosition = {
    x: Math.max(bounds.xMin, Math.min(bounds.xMax, x)),
    y: Math.max(bounds.yMin, Math.min(bounds.yMax, y))
  };
  coordX.value = Math.round(playerPosition.x);
  coordY.value = Math.round(playerPosition.y);
  positionReadout.textContent = `Set to X ${Math.round(playerPosition.x).toLocaleString("en-US")}, Y ${Math.round(playerPosition.y).toLocaleString("en-US")}`;
  const point = worldToScreen(playerPosition.x, playerPosition.y);
  view.x += canvas.clientWidth / 2 - point.x;
  view.y += canvas.clientHeight / 2 - point.y;
  scheduleDraw();
}

function initEvents() {
  searchInput.addEventListener("input", renderSidebar);
  document.querySelector("#showAll").addEventListener("click", () => {
    buckets.forEach((bucket) => bucket.categories.forEach((category) => {
      category.visible = true;
    }));
    update();
  });
  document.querySelector("#hideAll").addEventListener("click", () => {
    buckets.forEach((bucket) => bucket.categories.forEach((category) => {
      category.visible = false;
    }));
    hidePopup();
    update();
  });

  document.querySelector("#collapseSidebar").addEventListener("click", () => {
    page.classList.add("sidebar-closed");
    setTimeout(resize, 80);
  });
  document.querySelector("#openSidebar").addEventListener("click", () => {
    page.classList.remove("sidebar-closed");
    setTimeout(resize, 80);
  });

  document.querySelector("#markersTab").addEventListener("click", () => setTab("markers"));
  document.querySelector("#positionTab").addEventListener("click", () => setTab("position"));

  document.querySelector("#zoomIn").addEventListener("click", () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1.35));
  document.querySelector("#zoomOut").addEventListener("click", () => zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 0.75));
  document.querySelector("#resetView").addEventListener("click", () => {
    fitView();
    scheduleDraw();
  });

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    beginInteraction();
    isDragging = true;
    canvas.style.cursor = "grabbing";
    dragStart = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
  });

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    if (isDragging && dragStart) {
      view.x = dragStart.viewX + event.clientX - dragStart.x;
      view.y = dragStart.viewY + event.clientY - dragStart.y;
      scheduleDraw();
      return;
    }
    const marker = findMarker(screenX, screenY);
    if (marker !== hoveredMarker) {
      hoveredMarker = marker;
      canvas.style.cursor = marker ? "pointer" : "grab";
      scheduleDraw();
    }
  });

  canvas.addEventListener("pointerleave", () => {
    if (hoveredMarker) {
      hoveredMarker = null;
      scheduleDraw();
    }
    if (!isDragging) canvas.style.cursor = "grab";
  });

  canvas.addEventListener("pointerup", (event) => {
    const moved = dragStart ? Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) : 0;
    isDragging = false;
    dragStart = null;
    canvas.style.cursor = hoveredMarker ? "pointer" : "grab";
    endInteraction();
    if (moved > 5) return;
    const rect = canvas.getBoundingClientRect();
    const marker = findMarker(event.clientX - rect.left, event.clientY - rect.top);
    if (marker) showPopup(marker);
    else hidePopup();
  });

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    beginInteraction();
    const rect = canvas.getBoundingClientRect();
    zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.16 : 0.86);
    endInteraction(180);
  }, { passive: false });

  canvas.addEventListener("dblclick", (event) => {
    const rect = canvas.getBoundingClientRect();
    zoomAt(event.clientX - rect.left, event.clientY - rect.top, 1.8);
  });

  document.querySelector("#positionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    setPlayerPosition(parseCoord(coordX.value), parseCoord(coordY.value));
  });

  window.addEventListener("resize", scheduleResize);
}

function setTab(tab) {
  const markers = tab === "markers";
  document.querySelector("#markersTab").classList.toggle("is-active", markers);
  document.querySelector("#positionTab").classList.toggle("is-active", !markers);
  document.querySelector("#markersPanel").classList.toggle("is-active", markers);
  document.querySelector("#positionPanel").classList.toggle("is-active", !markers);
}

generateMarkers();
initEvents();
resize();
update();
