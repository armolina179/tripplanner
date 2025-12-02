"use strict";

// Type definitions
interface Place {
  name: string;
  coord: [number, number];
  desc: string;
}

interface WeatherItem {
  date: string;
  code: number;
  tMaxC: number;
  tMinC: number;
  precip: number;
}

interface OpenMeteoDaily {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily;
}

interface BudgetData {
  days: number;
  mealsPerDay: number;
  mealAvgSEK: number;
  transportSEK: number;
  attractionsSEK: number;
  miscSEK: number;
  sekPerUsd: number;
}

interface PackingItem {
  id: string;
  text: string;
  done: boolean;
}

interface FavoriteItem {
  id: string;
  title: string;
  url: string | null;
}

// Extend interfaces for libraries loaded via CDN
interface Window {
  jQuery?: JQueryStatic;
}

interface JQuery {
  magnificPopup(options?: any): JQuery;
}

// Globals are loaded via CDN - use type assertions where needed
// L and $ are available globally from Leaflet and jQuery type definitions

// Footer year
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});

// jQuery UI Tabs (with hash sync)
$(function () {
  const $tabs = $("#itinerary-tabs").tabs({
    active: 0,
    heightStyle: "content",
    activate: function (_evt: JQueryEventObject, ui: JQueryUI.TabsActivationUIParams) {
      const id = ui.newPanel.attr("id");
      if (id) history.replaceState(null, "", "#" + id);
    }
  });

  const hash = window.location.hash;
  if (hash && $(hash).length) {
    const index = $("#itinerary-tabs a[href='" + hash + "']").parent().index();
    if (index >= 0) $tabs.tabs("option", "active", index);
  }
});

// Leaflet Map
(function initMap(): void {
  const map = L.map("mapGbg", { scrollWheelZoom: false }).setView([57.703, 11.97], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  const iconCity   = L.divIcon({ className:"pin city",   iconSize:[14,14], iconAnchor:[7,7] });
  const iconIsland = L.divIcon({ className:"pin island", iconSize:[14,14], iconAnchor:[7,7] });

  const cityPlaces: Place[] = [
    { name:"Haga (Haga Nygata)",          coord:[57.698356, 11.960484], desc:"Cafés & wooden houses" },
    { name:"Järntorget",                   coord:[57.693200, 11.951700], desc:"Transport hub by Haga" },
    { name:"Hagakyrkan",                   coord:[57.699069, 11.962276], desc:"Neo-Gothic church" },
    { name:"Magasinsgatan (da Matteo)",    coord:[57.703666, 11.962604], desc:"Courtyard cafés" },
    { name:"Trädgårdsföreningen",          coord:[57.704756, 11.975356], desc:"Garden Society park" },
    { name:"Korsvägen",                    coord:[57.696504, 11.986281], desc:"Events district hub" },
    { name:"Liseberg",                     coord:[57.695219, 11.992464], desc:"Amusement park" },
    { name:"Stenpiren Travel Centre",      coord:[57.706100, 11.957500], desc:"City ferry hub" },
    { name:"Saltholmen Ferry Terminal",    coord:[57.661126, 11.840623], desc:"Boats to the islands" }
  ];
  const islandPlaces: Place[] = [
    { name:"Styrsö (island)",              coord:[57.617000, 11.783000], desc:"Archipelago day trip" },
    { name:"Vrångö (island)",              coord:[57.572730, 11.783050], desc:"Southernmost island" }
  ];

  const featureGroup = L.featureGroup().addTo(map);
  const popupHtml = (p: Place): string => {
    const [lat, lon] = p.coord;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    return `<strong>${p.name}</strong><br>${p.desc}<br><a href="${osm}" target="_blank" rel="noopener">Open in Maps</a>`;
  };
  cityPlaces.forEach(p => L.marker(p.coord, { icon: iconCity, title: p.name, alt: p.name }).addTo(featureGroup).bindPopup(popupHtml(p)));
  islandPlaces.forEach(p => L.marker(p.coord, { icon: iconIsland, title: p.name, alt: p.name }).addTo(featureGroup).bindPopup(popupHtml(p)));
  map.fitBounds(featureGroup.getBounds(), { padding:[20,20] });

  const legend = (L.control as any)({ position: "topright" }) as any;
  legend.onAdd = function(): HTMLElement {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = `
      <div class="row"><span class="swatch city"></span> City highlights</div>
      <div class="row"><span class="swatch island"></span> Islands & ferries</div>
    `;
    return div;
  };
  legend.addTo(map);
})();

// Weather (fetch + .then chains)
(function initWeather(): void {
  const lat = 57.7089, lon = 11.9746; // Gothenburg coordinates
  const trip = { start: "2025-08-20", end: "2025-08-24" }; // Trip dates

  const $weatherStatus = $("#weatherStatus");
  const $weatherGrid = $("#weatherGrid");
  const $weatherError = $("#weatherError");
  const $btnCelsius = $("#btnC");
  const $btnFahrenheit = $("#btnF");

  let units: "C" | "F" = localStorage.getItem("wxUnits") === "F" ? "F" : "C";
  let items: WeatherItem[] | null = null;

  function setUnitButtons(): void {
    const isCelsius = units === "C";
    $btnCelsius.toggleClass("is-active", isCelsius).attr("aria-pressed", String(isCelsius));
    $btnFahrenheit.toggleClass("is-active", !isCelsius).attr("aria-pressed", String(!isCelsius));
  }
  setUnitButtons();

  function codeToIcon(code: number): string {
    if (code === 0) return "☀️";
    if ([1,2].includes(code)) return "🌤️";
    if (code === 3) return "☁️";
    if ([45,48].includes(code)) return "🌫️";
    if ([51,53,55].includes(code)) return "🌦️";
    if ([61,63,65,66,67,80,81,82].includes(code)) return "🌧️";
    if ([71,73,75,77,85,86].includes(code)) return "🌨️";
    if ([95,96,99].includes(code)) return "⛈️";
    return "🌡️";
  }
  const toFahrenheit = (c: number): number => Math.round((c * 9/5) + 32);

  function renderWeather(): void {
    if (!items) return;
    const fmt = new Intl.DateTimeFormat(undefined, { weekday:"short", month:"short", day:"numeric" });
    const html = items.map(it => {
      const tMax = units === "C" ? `${it.tMaxC}°C` : `${toFahrenheit(it.tMaxC)}°F`;
      const tMin = units === "C" ? `${it.tMinC}°C` : `${toFahrenheit(it.tMinC)}°F`;
      return `
        <article class="wx-card" aria-label="${it.date} forecast">
          <div class="wx-date">${fmt.format(new Date(it.date))}</div>
          <div class="wx-icon" aria-hidden="true">${codeToIcon(it.code)}</div>
          <div class="wx-temps">High: ${tMax}<br>Low: ${tMin}</div>
          <div class="wx-precip">Precip: ${it.precip} mm</div>
        </article>
      `;
    }).join("");
    $weatherGrid.html(html);
  }

  $btnCelsius.on("click", function(): void { 
    units = "C"; 
    localStorage.setItem("wxUnits","C"); 
    setUnitButtons(); 
    renderWeather(); 
  });
  $btnFahrenheit.on("click", function(): void { 
    units = "F"; 
    localStorage.setItem("wxUnits","F"); 
    setUnitButtons(); 
    renderWeather(); 
  });

  function fetchDaily(url: string): Promise<OpenMeteoDaily> {
    return fetch(url, { cache: "no-store" })
      .then((res: Response) => { 
        if (!res.ok) throw new Error("Network error: " + res.status); 
        return res.json(); 
      })
      .then((data: OpenMeteoResponse) => {
        if (!data.daily || !data.daily.time) throw new Error("No daily data");
        return data.daily;
      });
  }

  const base = `latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

  // Try exact dates, then 7-day fallback
  fetchDaily(`https://api.open-meteo.com/v1/forecast?${base}&start_date=${trip.start}&end_date=${trip.end}`)
    .then((daily: OpenMeteoDaily) => {
      items = daily.time.map((dateStr: string, i: number): WeatherItem => ({
        date: dateStr,
        code: daily.weathercode[i],
        tMaxC: Math.round(daily.temperature_2m_max[i]),
        tMinC: Math.round(daily.temperature_2m_min[i]),
        precip: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10
      }));
      $weatherStatus.text("");
      renderWeather();
    })
    .catch(() => {
      return fetchDaily(`https://api.open-meteo.com/v1/forecast?${base}&forecast_days=7`)
        .then((daily: OpenMeteoDaily) => {
          items = daily.time.map((dateStr: string, i: number): WeatherItem => ({
            date: dateStr,
            code: daily.weathercode[i],
            tMaxC: Math.round(daily.temperature_2m_max[i]),
            tMinC: Math.round(daily.temperature_2m_min[i]),
            precip: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10
          }));
          $weatherStatus.text("");
          renderWeather();
        })
        .catch(() => {
          $weatherStatus.text("");
          $weatherError.text("Couldn't load weather right now. Please try again later.").prop("hidden", false);
        });
    });
})();

// Magnific Popup (lightbox) init with fallback
(function initLightbox(): void {
  function hasPlugin(): boolean {
    const jQuery = (window as any).jQuery;
    return !!(jQuery && jQuery.fn && typeof jQuery.fn.magnificPopup === "function");
  }
  function bindLightbox(): void {
    if (!document.getElementById("photoGallery")) return;
    $("#photoGallery").magnificPopup({
      delegate:"a",
      type:"image",
      gallery:{ enabled:true, tPrev:"Prev", tNext:"Next", tCounter:"%curr% of %total%" },
      image:{ titleSrc:"title", verticalFit:true },
      loop:true,
      zoom:{ enabled:false }
    });
    console.info("[Lightbox] Magnific bound to #photoGallery");
  }
  function loadFallback(cb: () => void): void {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/magnific-popup@1.1.0/dist/jquery.magnific-popup.min.js";
    s.async = true;
    s.onload = cb;
    s.onerror = function(): void { 
        console.error("[Lightbox] Fallback Magnific failed to load"); 
    };
    document.head.appendChild(s);
  }
  if (hasPlugin()) { bindLightbox(); return; }
  window.addEventListener("load", function(): void {
    if (hasPlugin()) { bindLightbox(); return; }
    loadFallback(function(): void { 
        if (hasPlugin()) bindLightbox(); 
    });
  });
})();

// Trip Tools (Web Storage)
(function tripTools(): void {
  const hasStorage = ((): boolean => {
    try { 
      const testKey="__t", v=String(Date.now()); 
      localStorage.setItem(testKey, v); 
      const ok = localStorage.getItem(testKey) === v; 
      localStorage.removeItem(testKey); 
      return ok; 
    } catch(e){ 
      return false; 
    }
  })();
  if (!hasStorage) { console.warn("localStorage not available — Trip Tools will not persist."); }

  // Budget Estimator
  const bdKey = "gbg_budget_v1";
  const $bd = {
    days: $("#bdDays"), 
    meals: $("#bdMealsPerDay"), 
    mealAvg: $("#bdMealAvg"),
    transport: $("#bdTransport"), 
    attr: $("#bdAttractions"), 
    misc: $("#bdMisc"),
    rate: $("#bdRate"), 
    totalSEK: $("#bdTotalSEK"), 
    totalUSD: $("#bdTotalUSD")
  };
  const readNum = ($el: JQuery<HTMLElement>): number => { 
    const n = parseFloat($el.val() as string); 
    return isNaN(n) ? 0 : n; 
  };
  function calcBudget(): BudgetData {
    const days = Math.max(0, Math.round(readNum($bd.days)));
    const meals = Math.max(0, Math.round(readNum($bd.meals)));
    const mealAvg = Math.max(0, readNum($bd.mealAvg));
    const transport = Math.max(0, readNum($bd.transport));
    const attractions = Math.max(0, readNum($bd.attr));
    const misc = Math.max(0, readNum($bd.misc));
    const rate = Math.max(0.0001, readNum($bd.rate));
    const mealsTotal = days * meals * mealAvg;
    const totalSEK = Math.round(mealsTotal + transport + attractions + misc);
    const totalUSD = Math.round((totalSEK / rate) * 100) / 100;
    $bd.totalSEK.text(`Total: ${totalSEK.toLocaleString()} SEK`);
    $bd.totalUSD.text(`≈ ${totalUSD.toLocaleString(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })} USD`);
    return { days, mealsPerDay: meals, mealAvgSEK: mealAvg, transportSEK: transport, attractionsSEK: attractions, miscSEK: misc, sekPerUsd: rate };
  }
  function saveBudget(): void { 
    if(!hasStorage) return; 
    localStorage.setItem(bdKey, JSON.stringify(calcBudget())); 
  }
  function loadBudget(): void {
    if(!hasStorage) { calcBudget(); return; }
    const raw = localStorage.getItem(bdKey); 
    if(!raw){ calcBudget(); return; }
    try{
      const d: Partial<BudgetData> = JSON.parse(raw) || {};
      $bd.days.val(d.days ?? 4); 
      $bd.meals.val(d.mealsPerDay ?? 2); 
      $bd.mealAvg.val(d.mealAvgSEK ?? 140);
      $bd.transport.val(d.transportSEK ?? 450); 
      $bd.attr.val(d.attractionsSEK ?? 600); 
      $bd.misc.val(d.miscSEK ?? 300);
      $bd.rate.val(d.sekPerUsd ?? 9.55);
    }catch(e){
      // Silently handle parse errors
    }
    calcBudget();
  }
  $("#bdReset").on("click", function(): void {
    $bd.days.val(4); 
    $bd.meals.val(2); 
    $bd.mealAvg.val(140); 
    $bd.transport.val(450);
    $bd.attr.val(600); 
    $bd.misc.val(300); 
    $bd.rate.val(9.55);
    saveBudget();
  });
  $("#bdClear").on("click", function(): void {
    if(hasStorage) localStorage.removeItem(bdKey);
    $bd.days.val(0); 
    $bd.meals.val(0); 
    $bd.mealAvg.val(0);
    $bd.transport.val(0); 
    $bd.attr.val(0); 
    $bd.misc.val(0);
    $bd.rate.val(9.55);
    calcBudget();
  });
  $("#toolBudget input").on("input", saveBudget);
  loadBudget();

  // Packing Checklist
  const pkKey = "gbg_pack_v1";
  const $pkList = $("#pkList"), $pkInput = $("#pkInput");
  function renderPack(items: PackingItem[]): void {
    $pkList.empty();
    if(!items.length){ 
      $pkList.append('<div class="empty">No items yet — add a few!</div>'); 
      return; 
    }
    items.forEach(item => {
      const $row = $(`<div class="list-item" data-id="${item.id}"></div>`);
      const safeText = $('<div>').text(item.text).html();
      const $cb = $(`<input type="checkbox" ${item.done?'checked':''} aria-label="Mark ${safeText} as ${item.done?'not done':'done'}">`);
      const $txt = $(`<span>${safeText}</span>`);
      const $del = $(`<button class="btn danger small" data-action="remove" aria-label="Delete ${safeText}">Delete</button>`);
      if(item.done) $row.addClass("done");
      $row.append($cb, $txt, $('<span class="spacer"></span>'), $del);
      $pkList.append($row);
    });
  }
  function loadPack(): void {
    try{ 
      const arr: PackingItem[] = JSON.parse(localStorage.getItem(pkKey) || "[]") || []; 
      renderPack(arr); 
    }
    catch(e){ 
      renderPack([]); 
    }
  }
  function getPack(): PackingItem[] { 
    try{ 
      return JSON.parse(localStorage.getItem(pkKey) || "[]") || []; 
    } catch(e){ 
      return []; 
    } 
  }
  function savePack(): void {
    const items: PackingItem[] = [];
    $pkList.find(".list-item").each(function(this: HTMLElement): void {
      const $row = $(this);
      const id = $row.attr("data-id");
      const text = $row.find("span").first().text();
      const done = $row.find('input[type=checkbox]').prop("checked") as boolean;
      if (id) {
        items.push({ id, text, done });
      }
    });
    localStorage.setItem(pkKey, JSON.stringify(items));
  }
  function addPack(text: string | number | string[] | undefined): void {
    const clean = (typeof text === 'string' ? text : String(text || "")).trim(); 
    if(!clean) return;
    const id = "i" + Date.now() + Math.random().toString(16).slice(2);
    const items = getPack(); 
    items.push({ id, text: clean, done:false }); 
    localStorage.setItem(pkKey, JSON.stringify(items)); 
    loadPack();
  }
  $("#pkAdd").on("click", function(): void { 
    addPack($pkInput.val()); 
    $pkInput.val("").trigger("focus"); 
  });
  $pkInput.on("keydown", function(e: JQuery.KeyDownEvent): void { 
    if(e.key === "Enter"){ 
      e.preventDefault(); 
      $("#pkAdd").trigger("click"); 
    }
  });
  $pkList.on("change",'input[type=checkbox]', function(this: HTMLElement): void { 
    $(this).closest(".list-item").toggleClass("done", (this as HTMLInputElement).checked); 
    savePack(); 
  });
  $pkList.on("click",'button[data-action="remove"]', function(this: HTMLElement): void {
    const id = $(this).closest(".list-item").attr("data-id");
    if (!id) return;
    const items = getPack().filter(i => i.id !== id);
    localStorage.setItem(pkKey, JSON.stringify(items));
    loadPack();
  });
  $("#pkClearChecked").on("click", function(): void { 
    const items = getPack().filter(i => !i.done); 
    localStorage.setItem(pkKey, JSON.stringify(items)); 
    loadPack(); 
  });
  $("#pkClearAll").on("click", function(): void { 
    localStorage.removeItem(pkKey); 
    loadPack(); 
  });
  loadPack();

  // Favorites 
  const fvKey = "gbg_faves_v1";
  const $fvTitle = $("#fvTitle"), $fvUrl = $("#fvUrl"), $fvList = $("#fvList");
  function renderFavorites(items: FavoriteItem[]): void {
    $fvList.empty();
    if(!items.length){ 
      $fvList.append('<div class="empty">No favorites yet.</div>'); 
      return; 
    }
    items.forEach(f => {
      const safeTitle = $("<div>").text(f.title).html();
      const link = f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${safeTitle}</a>` : safeTitle;
      const rowHtml = `
        <div class="list-item" data-id="${f.id}">
          ${link}
          <span class="spacer"></span>
          <button class="btn danger small" data-action="remove" aria-label="Remove ${safeTitle}">Remove</button>
        </div>`;
      $fvList.append(rowHtml);
    });
  }
  function loadFavorites(): void { 
    try{ 
      renderFavorites(JSON.parse(localStorage.getItem(fvKey) || "[]") || []);
    } catch(e){ 
      renderFavorites([]);
    } 
  }
  function saveFavorites(items: FavoriteItem[]): void { 
    localStorage.setItem(fvKey, JSON.stringify(items)); 
  }
  function getFavorites(): FavoriteItem[] { 
    try{ 
      return JSON.parse(localStorage.getItem(fvKey) || "[]") || []; 
    } catch(e){ 
      return []; 
    } 
  }

  $("#fvAdd").on("click", function(): void {
    const title = (($fvTitle.val() as string) || "").trim();
    const url = (($fvUrl.val() as string) || "").trim();
    if(!title) return;
    const items = getFavorites();
    items.push({ id: "f" + Date.now() + Math.random().toString(16).slice(2), title, url: url || null });
    saveFavorites(items);
    $fvTitle.val(""); 
    $fvUrl.val("");
    loadFavorites();
  });
  $("#fvClear").on("click", function(): void { 
    localStorage.removeItem(fvKey); 
    loadFavorites(); 
  });
  $fvList.on("click", 'button[data-action="remove"]', function(this: HTMLElement): void {
    const id = $(this).closest(".list-item").attr("data-id");
    if (!id) return;
    const items = getFavorites().filter(x => x.id !== id);
    saveFavorites(items);
    loadFavorites();
  });
  loadFavorites();
})();

