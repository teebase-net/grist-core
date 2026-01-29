/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.5-Stable (Hardened & Decoupled)
 * OWNER: teebase-net (MOD DMH)
 * * 📄 PERMANENT FEATURE MANIFEST (INDEPENDENT MODULES):
 * 1. VERSION LOGGING: Console verification on boot.
 * 2. WEBSOCKET SNIFFING: docId extraction.
 * 3. THEME ENFORCEMENT: Force dark mode.
 * 4. DISPLAY DENSITY: 22px Row / 11px Font.
 * 5. DISCRETE TIMER: GitHub-grey bottom-right countdown.
 * 6. PERMISSION CLOAKING: SysUsers-based UI hiding.
 * 7. HARDENED CSS: 30px Row Numbers & Frozen Column Alignment Fix.
 * 8. SESSION WATCHDOG: Restored Large Orange Modal (Centered).
 * 9. ACTION HIGHLIGHTING: Red 'Delete' commands.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  const VERSION = "2.3.5-Stable";
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;
  let capturedDocId = null;

  // --- 1. VERSION LOGGING ---
  try {
    console.log(
      `%c ${LOG_PREFIX} SYSTEM BOOT %c v${VERSION} `,
      "background: #24292e; color: #f97583; font-weight: bold; border-radius: 3px 0 0 3px;",
      "background: #6a737d; color: #fff; font-weight: bold; border-radius: 0 3px 3px 0;"
    );
  } catch (e) { /* Isolated Failure */ }

  // --- 2. WEBSOCKET SNIFFING ---
  (function() {
    try {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function (data) {
        try {
          const msg = JSON.parse(data);
          if (msg?.method === "openDoc" && msg.args?.length) { capturedDocId = msg.args[0]; }
        } catch (err) { }
        return originalSend.call(this, data);
      };
    } catch (e) { console.error(`${LOG_PREFIX} WS Sniffer Failed`, e); }
  })();

  // --- 3, 4, 7. THEME, DENSITY & HARDENED CSS (FROZEN FIX) ---
  function applyVisuals() {
    try {
      document.body.classList.add('theme-dark');
      if (document.getElementById("teebase-visual-overrides")) return;
      const style = document.createElement("style");
      style.id = "teebase-visual-overrides";
      style.textContent = `
        :root { 
          --grid-row-height: 22px !important; 
          --font-size: 11px !important; 
          --grid-row-num-width: 30px !important; 
          --gridview-rownum-width: 30px !important; 
        }
        .gridview_data_row { height: 22px !important; }
        .gridview_data_cell { padding: 0 4px !important; line-height: 22px !important; }

        /* Unified 30px Selectors */
        .gridview_data_row_num, .gridview_row_numbers, .gridview_header_corner, 
        .gridview_corner_spacer, .gridview_data_corner_overlay, .record_selector { 
          width: 30px !important; min-width: 30px !important; max-width: 30px !important; flex: 0 0 30px !important;
        }

        /* FROZEN COLUMN ALIGNMENT FIX */
        .scroll_shadow_left, .scroll_shadow_frozen, .gridview_stick_left, .gridview_frozen { 
          left: 30px !important; 
        }
        .gridview_header_backdrop_left { width: 31px !important; }

        .test-grist-doc, .view_data_pane_container { padding: 0px !important; margin: 0px !important; }

        #teebase-timer-node { position: fixed; bottom: 8px; right: 12px; font-family: sans-serif; font-size: 11px; color: #6a737d; pointer-events: none; z-index: 9999; opacity: 0.8; }
      `;
      document.head.appendChild(style);
    } catch (e) { console.error(`${LOG_PREFIX} Visuals Failed`, e); }
  }

  // --- 5, 8. WATCHDOG & TIMER (RESTORED ORANGE MODAL) ---
  function setupWatchdog(mins) {
    try {
      const MS = (mins || DEFAULT_TIMEOUT_MINS) * 60 * 1000;
      const WARN_MS = 120000;
      let lastReset = Date.now();
      let timer, warnTimer, countdownNode;

      const updateDisplay = () => {
        try {
          if (!countdownNode) {
            countdownNode = document.createElement("div");
            countdownNode.id = "teebase-timer-node";
            document.body.appendChild(countdownNode);
          }
          const rem = Math.max(0, Math.floor((MS - (Date.now() - lastReset)) / 1000));
          countdownNode.innerText = `Sess: ${Math.floor(rem/60)}:${(rem%60).toString().padStart(2, '0')}`;
        } catch (e) { }
      };

      const showWarning = () => {
        try {
          let w = document.getElementById("logout-warning") || document.createElement("div");
          w.id = "logout-warning";
          // MATCHING IMAGE: Large orange rounded modal
          Object.assign(w.style, {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "#ffa500", color: "white", padding: "60px", width: "500px",
            borderRadius: "30px", zIndex: "1000000", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            fontFamily: "sans-serif"
          });
          w.innerHTML = `
            <div style="font-size:42px; font-weight:bold; margin-bottom:20px;">Session Expiring</div>
            <div style="font-size:20px; margin-bottom:20px;">You will be logged out due to inactivity in:</div>
            <div id="w-count" style="font-size:100px; font-weight:bold; margin-bottom:20px;">2:00</div>
            <div style="font-size:18px;">Move mouse or click to stay logged in</div>
          `;
          document.body.appendChild(w);
          let sec = 120;
          const int = setInterval(() => {
            sec--;
            if (document.getElementById("w-count")) document.getElementById("w-count").innerText = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
            if (sec <= 0) { clearInterval(int); window.location.href = "/logout"; }
          }, 1000);
          w.dataset.int = int;
        } catch (e) { }
      };

      const reset = () => {
        try {
          lastReset = Date.now();
          const w = document.getElementById("logout-warning");
          if (w) { w.style.display = "none"; clearInterval(parseInt(w.dataset.int)); }
          clearTimeout(timer); clearTimeout(warnTimer);
          warnTimer = setTimeout(showWarning, MS - WARN_MS);
          timer = setTimeout(() => window.location.href = "/logout", MS);
        } catch (e) { }
      };

      ["mousedown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, reset, { capture: true }));
      setInterval(updateDisplay, 1000);
      reset();
    } catch (e) { console.error(`${LOG_PREFIX} Watchdog Failed`, e); }
  }

  // --- 6. PERMISSION CLOAKING ---
  async function applyPermissions(docId) {
    try {
      const profile = await fetch("/api/profile/user").then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`).then(r => r.json());
      const idx = res.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());
      const perms = {
        canAdd: res.Unlock_Structure?.[idx] === true,
        canExport: res.Export_Data?.[idx] === true,
        timeout: res.Timeout_Minutes?.[idx] || DEFAULT_TIMEOUT_MINS
      };
      const observer = new MutationObserver(() => {
        document.querySelectorAll(".mod-add-column").forEach(el => el.style.display = perms.canAdd ? "" : "none");
        document.querySelectorAll(".test-tb-share, .test-download-section").forEach(el => el.style.display = perms.canExport ? "" : "none");
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return perms;
    } catch (e) { return { canAdd: false, canExport: false, timeout: DEFAULT_TIMEOUT_MINS }; }
  }

  // --- 9. ACTION HIGHLIGHTING ---
  function setupHighlighting() {
    try {
      const observer = new MutationObserver(() => {
        document.querySelectorAll(".test-cmd-name").forEach(s => {
          if (["Delete", "Delete record", "Delete widget"].includes(s.textContent?.trim())) {
            s.style.color = "#f97583"; s.style.fontWeight = "bold";
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) { }
  }

  // --- BOOTSTRAP ---
  window.addEventListener("load", async () => {
    applyVisuals();
    setupHighlighting();
    const start = Date.now();
    while (Date.now() - start < 3000 && !capturedDocId && !window.gristDoc?.docId) { 
      await new Promise(r => setTimeout(r, 100)); 
    }
    const docId = window.gristDoc?.docId || capturedDocId;
    const config = docId ? await applyPermissions(docId) : { timeout: DEFAULT_TIMEOUT_MINS };
    setupWatchdog(config.timeout);
  });
})();
