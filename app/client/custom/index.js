/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.3.2-Stable-Production
 * OWNER: teebase-net (MOD DMH)
 * LOCATION: /opt/grist/dev/index.js (Target: app/client/custom/index.js)
 * * 📄 PERMANENT FEATURE MANIFEST:
 * 1. WEBSOCKET SNIFFING: 
 * Intercepts 'openDoc' to extract docId before Grist UI initialization.
 * 2. THEME ENFORCEMENT: 
 * Forces 'dark' theme body class to prevent UI flash and ensure consistency.
 * 3. DISPLAY DENSITY (COMPACT): 
 * Surgically compresses grid rows to 22px and reduces global font/padding.
 * 4. DISCRETE DIAGNOSTIC TIMER: 
 * Muted GitHub-grey (#6a737d) session countdown in bottom-right corner.
 * 5. PERMISSION-BASED UI CLOAKING: 
 * Dynamically hides 'Add Column', 'Share', and 'Export' based on SysUsers table.
 * 6. SURGICAL CSS OVERRIDES: 
 * Forces 30px row-number width and 0px layout padding for maximum workspace.
 * 7. SESSION WATCHDOG: 
 * Activity-based idle timer with a 2-minute warning UI before /logout.
 * 8. DESTRUCTIVE ACTION HIGHLIGHTING: 
 * Forces 'Delete' commands to bold red (#f97583) for user safety.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;
  let capturedDocId = null;

  /**
   * SECTION 1: WEBSOCKET INTERCEPTION
   * Low-level sniffer to capture docId for early-stage API calls.
   */
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
      }
    } catch (err) {}
    return originalSend.call(this, data);
  };

  /**
   * SECTION 2: THEME & DENSITY (MOD DMH)
   * Forces visual parameters. Row height set to 22px for extreme compactness.
   */
  function applyVisuals() {
    document.body.classList.add('theme-dark');
    if (document.getElementById("teebase-visual-overrides")) return;
    const style = document.createElement("style");
    style.id = "teebase-visual-overrides";
    style.textContent = `
      /* Global Density & Grid Variables */
      :root { 
        --grid-row-height: 22px !important; 
        --font-size: 11px !important; 
        --gridview-rownum-width: 30px !important; 
      }
      .gridview_data_row { height: 22px !important; }
      .gridview_data_cell { padding: 0 4px !important; line-height: 22px !important; }
      
      /* Row Number Compression (30px surgical fix) */
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_row_numbers, .gridview_header_corner { 
        width: 30px !important; min-width: 30px !important; max-width: 30px !important; 
      }
      .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }

      /* Layout Padding Removal (0px) */
      .test-grist-doc { padding: 0px !important; }
      
      /* Discrete Timer Styling (GitHub-Muted Grey) */
      #teebase-timer-node {
        position: fixed; bottom: 8px; right: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        font-size: 11px; color: #6a737d;
        pointer-events: none; z-index: 9999; opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * SECTION 3: SESSION IDLE TIMER (DISCRETE)
   * Monitors mouse/keyboard and updates the discrete bottom-right countdown.
   */
  function setupWatchdog(mins) {
    const MS = mins * 60 * 1000;
    const WARN_MS = 120000;
    let lastReset = Date.now();
    let timer, warnTimer, countdownNode;

    const updateDisplay = () => {
      if (!countdownNode) {
        countdownNode = document.createElement("div");
        countdownNode.id = "teebase-timer-node";
        document.body.appendChild(countdownNode);
      }
      const rem = Math.max(0, Math.floor((MS - (Date.now() - lastReset)) / 1000));
      const m = Math.floor(rem/60), s = rem%60;
      countdownNode.innerText = `Sess: ${m}:${s.toString().padStart(2, '0')}`;
    };

    const logout = () => window.location.href = "/logout";

    const showWarning = () => {
      let w = document.getElementById("logout-warning") || document.createElement("div");
      w.id = "logout-warning";
      Object.assign(w.style, {
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "#24292e", color: "#e1e4e8", padding: "30px", zIndex: "1000001",
        borderRadius: "6px", border: "1px solid #444", textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
      });
      w.innerHTML = `<div style="font-size:16px;margin-bottom:10px">Inactivity Timeout</div><div id="w-count" style="font-size:24px;font-weight:bold">2:00</div>`;
      document.body.appendChild(w);
      w.style.display = "block";
      
      let sec = 120;
      const int = setInterval(() => {
        sec--;
        if (document.getElementById("w-count")) document.getElementById("w-count").innerText = `${Math.floor(sec/60)}:${(sec%60).toString().padStart(2,'0')}`;
        if (sec <= 0) { clearInterval(int); logout(); }
      }, 1000);
      w.dataset.int = int;
    };

    const reset = () => {
      lastReset = Date.now();
      const w = document.getElementById("logout-warning");
      if (w) { w.style.display = "none"; clearInterval(w.dataset.int); }
      clearTimeout(timer); clearTimeout(warnTimer);
      warnTimer = setTimeout(showWarning, MS - WARN_MS);
      timer = setTimeout(logout, MS);
    };

    ["mousedown", "keydown", "touchstart"].forEach(e => document.addEventListener(e, reset, { capture: true }));
    setInterval(updateDisplay, 1000);
    reset();
  }

  /**
   * SECTION 4: PERMISSIONS & UI CLOAKING
   * Fetches SysUsers table and hides unauthorized DOM elements.
   */
  async function applyPermissions(docId) {
    try {
      const profile = await fetch("/api/profile/user", { credentials: "include" }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: "include" });
      const data = await res.json();
      const idx = data.Email?.findIndex(e => e?.toLowerCase() === profile.email?.toLowerCase());

      const perms = {
        canAdd: data.Unlock_Structure?.[idx] === true,
        canExport: data.Export_Data?.[idx] === true,
        timeout: data.Timeout_Minutes?.[idx] || DEFAULT_TIMEOUT_MINS
      };

      const hide = (sel, visible) => {
        const apply = () => document.querySelectorAll(sel).forEach(el => el.style.display = visible ? "" : "none");
        apply(); new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
      };

      hide(".mod-add-column", perms.canAdd);
      hide(".test-tb-share", perms.canExport);
      hide(".test-download-section", perms.canExport);
      
      return perms;
    } catch (e) { return { canAdd: false, canExport: false, timeout: DEFAULT_TIMEOUT_MINS }; }
  }

  /**
   * SECTION 5: BOOTSTRAP ORCHESTRATOR
   * Runs the sequence on load with a 3s polling for docId stabilization.
   */
  const boot = async () => {
    applyVisuals();
    const start = Date.now();
    while (Date.now() - start < 3000 && !capturedDocId && !window.gristDoc?.docId) { 
      await new Promise(r => setTimeout(r, 100)); 
    }
    const docId = window.gristDoc?.docId || capturedDocId;

    if (docId) {
      const config = await applyPermissions(docId);
      setupWatchdog(config.timeout);
      
      const highlight = () => {
        document.querySelectorAll(".test-cmd-name").forEach(s => {
          const txt = s.textContent?.trim();
          if (["Delete", "Delete record", "Delete widget"].includes(txt)) {
            s.style.color = "#f97583"; /* GitHub Red */
            s.style.fontWeight = "bold";
            s.classList.add("custom-highlight");
          }
        });
      };
      new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
    } else {
      setupWatchdog(DEFAULT_TIMEOUT_MINS);
    }
  };

  window.addEventListener("load", boot);
})();
