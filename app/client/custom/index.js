/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.8-Modular
 * OWNER: teebase-net (MOD DMH)
 * * 📄 PERMANENT FEATURE MANIFEST & TECHNICAL DOCUMENTATION:
 * * 1. VERSION LOGGING
 * - Minimal console footprint. Identifies patch version on boot.
 * * 2. WEBSOCKET SNIFFING
 * - Proxies WebSocket.prototype.send to intercept "openDoc" methods.
 * - Captures the 'docId' required for API calls before Grist fully initializes.
 * * 3. THEME ENFORCEMENT (User-Based)
 * - Controlled by 'SysUsers.Theme'.
 * - 'dark' adds .theme-dark class; any other value defaults to standard Grist.
 * * 4. GRIDVIEW ALIGNMENT (Legacy 30px Snap)
 * - Reverts to v1.7 logic. Overrides Grist's 52px default row-number width.
 * - Uses CSS variables and calc() to align frozen panes dynamically.
 * - Formula: left = 30px + (var(--frozen-width-prefix) * 1px).
 * * 5. DEV BANNER
 * - Checks document name for "- DEV" suffix via Grist REST API.
 * - Injects a 10px pink (#f48fb1) safety banner at the top of the viewport.
 * * 6. DISCRETE TIMER
 * - Sub-overlay (bottom-right) showing real-time session remaining (MM:SS).
 * - Non-interactive (pointer-events: none) to prevent UI interference.
 * * 7. PERMISSION & CONFIG CLOAKING
 * - Source: 'SysUsers' table. 
 * - Columns: [Unlock_Structure] (Bool), [Export_Data] (Bool).
 * - Hides '.mod-add-column', '.test-tb-share', and '.test-download-section'.
 * - Managed via MutationObserver for persistence during view changes.
 * * 8. SESSION WATCHDOG (Large Orange Modal)
 * - Activity monitoring on: mousedown, keydown, touchstart.
 * - Warning: Triggers at T-minus 120s with a 500px wide orange overlay.
 * - Enforcement: Immediate redirect to /logout upon expiry.
 * * 9. ACTION HIGHLIGHTING
 * - Watches context menus for destructive keywords ("Delete").
 * - Forces bold red (#f97583) to prevent accidental data/widget deletion.
 * * REQUIREMENTS:
 * - Table 'SysUsers' must exist with columns: Email, Unlock_Structure, 
 * Export_Data, Timeout_Minutes, Theme.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  const VERSION = "2.3.8-Modular";
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;
  let capturedDocId = null;

  // --- 1. VERSION LOGGING ---
  console.log(`${LOG_PREFIX} BOOT v${VERSION}`);

  // --- 2. WEBSOCKET SNIFFING ---
  (function() {
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) {
      try {
        const msg = JSON.parse(data);
        if (msg?.method === "openDoc" && msg.args?.length) { 
          capturedDocId = msg.args[0]; 
        }
      } catch (err) { }
      return originalSend.call(this, data);
    };
  })();

  // --- 3. THEME ENFORCEMENT ---
  function applyTheme(theme) {
    if (theme?.toLowerCase() === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
  }

  // --- 4. GRIDVIEW ALIGNMENT (Legacy 30px Snap) ---
  function injectAlignmentStyles() {
    if (document.getElementById("teebase-alignment-fix")) return;
    const style = document.createElement("style");
    style.id = "teebase-alignment-fix";
    style.textContent = `
      :root { --gridview-rownum-width: 30px !important; }
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_data_corner_overlay, .gridview_row_numbers, .gridview_header_corner {
        width: 30px !important; min-width: 30px !important; max-width: 30px !important;
      }
      .scroll_shadow_left, .scroll_shadow_frozen, .gridview_header_backdrop_left {
        left: 30px !important;
      }
      .gridview_row .record .field.frozen {
        left: calc(30px + (var(--frozen-width-prefix, 0) * 1px)) !important;
      }
      .frozen_line {
        left: calc(30px + var(--frozen-width, 0) * 1px) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // --- 5. DEV BANNER ---
  async function checkDevBanner(docId) {
    try {
      const res = await fetch(`/api/docs/${docId}`);
      const data = await res.json();
      if (data.name && data.name.includes("- DEV")) {
        if (document.getElementById("custom-global-banner")) return;
        const banner = document.createElement("div");
        banner.id = "custom-global-banner";
        banner.innerText = "DEV ENVIRONMENT – This is a test document";
        Object.assign(banner.style, {
          position: "fixed", top: "0", left: "0", width: "100%", height: "10px",
          background: "#f48fb1", color: "#333", fontWeight: "bold", fontSize: "10px",
          textAlign: "center", lineHeight: "10px", zIndex: "9999"
        });
        document.body.prepend(banner);
        document.body.style.marginTop = "10px";
      }
    } catch (e) { }
  }

  // --- 6. DISCRETE TIMER ---
  function updateTimerUI(remainingSeconds) {
    let node = document.getElementById("teebase-timer-node");
    if (!node) {
      node = document.createElement("div");
      node.id = "teebase-timer-node";
      Object.assign(node.style, {
        position: "fixed", bottom: "8px", right: "12px", fontSize: "11px",
        color: "#6a737d", pointerEvents: "none", zIndex: "9999"
      });
      document.body.appendChild(node);
    }
    const m = Math.floor(remainingSeconds / 60);
    const s = (remainingSeconds % 60).toString().padStart(2, '0');
    node.innerText = `Sess: ${m}:${s}`;
  }

  // --- 7. PERMISSION & CONFIG CLOAKING ---
  async function loadConfig(docId) {
    try {
      const profile = await fetch("/api/profile/user").then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`).then(r => r.json());
      const idx = res.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());
      
      const config = {
        canAdd: res.Unlock_Structure?.[idx] === true,
        canExport: res.Export_Data?.[idx] === true,
        timeout: res.Timeout_Minutes?.[idx] || DEFAULT_TIMEOUT_MINS,
        theme: res.Theme?.[idx] || 'light'
      };

      const observer = new MutationObserver(() => {
        document.querySelectorAll(".mod-add-column").forEach(el => el.style.display = config.canAdd ? "" : "none");
        document.querySelectorAll(".test-tb-share, .test-download-section").forEach(el => el.style.display = config.canExport ? "" : "none");
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      applyTheme(config.theme);
      return config;
    } catch (e) { 
      return { timeout: DEFAULT_TIMEOUT_MINS, theme: 'light' }; 
    }
  }

  // --- 8. SESSION WATCHDOG ---
  function setupWatchdog(mins) {
    const MS = mins * 60 * 1000;
    const WARN_MS = 120000;
    let lastReset = Date.now();
    
    const reset = () => {
      lastReset = Date.now();
      const w = document.getElementById("logout-warning");
      if (w) w.style.display = "none";
    };

    ["mousedown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, reset, { capture: true }));

    setInterval(() => {
      const elapsed = Date.now() - lastReset;
      const remaining = Math.max(0, Math.floor((MS - elapsed) / 1000));
      updateTimerUI(remaining);

      if (elapsed >= (MS - WARN_MS)) {
        showWarning(remaining);
      }
      if (elapsed >= MS) window.location.href = "/logout";
    }, 1000);
  }

  function showWarning(seconds) {
    let w = document.getElementById("logout-warning");
    if (!w) {
      w = document.createElement("div");
      w.id = "logout-warning";
      Object.assign(w.style, {
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "#ffa500", color: "white", padding: "60px", width: "500px",
        borderRadius: "30px", zIndex: "1000000", textAlign: "center", fontFamily: "sans-serif"
      });
      w.innerHTML = `<b>Session Expiring</b><br><div id="w-count" style="font-size:80px"></div>`;
      document.body.appendChild(w);
    }
    w.style.display = "block";
    const countNode = document.getElementById("w-count");
    if (countNode) countNode.innerText = `${Math.floor(seconds/60)}:${(seconds%60).toString().padStart(2,'0')}`;
  }

  // --- 9. ACTION HIGHLIGHTING ---
  function setupHighlighting() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll(".test-cmd-name").forEach(s => {
        if (["Delete", "Delete record", "Delete widget"].includes(s.textContent?.trim())) {
          s.style.color = "red"; s.style.fontWeight = "bold";
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- BOOTSTRAP ---
  window.addEventListener("load", async () => {
    injectAlignmentStyles();
    setupHighlighting();
    
    let docId = window.gristDoc?.docId;
    const start = Date.now();
    while (!docId && (Date.now() - start < 3000)) {
      docId = window.gristDoc?.docId || capturedDocId;
      await new Promise(r => setTimeout(r, 100));
    }

    if (docId) {
      checkDevBanner(docId);
      const config = await loadConfig(docId);
      setupWatchdog(config.timeout);
    } else {
      setupWatchdog(DEFAULT_TIMEOUT_MINS);
    }
  });
})();
