/**
 * ==============================================================================
 * SYSTEM: Grist Custom Master Controller (index.js)
 * VERSION: v2.2.0-Production (Merged & Hardened)
 * OWNER: teebase-net (MOD DMH)
 * * DESCRIPTION:
 * This script serves as the global orchestrator for Grist. It combines surgical
 * DOM/CSS overrides with dynamic user permissions and session management.
 * * CORE FEATURES:
 * 1. WEBSOCKET SNIFFING: Captures docId from Grist traffic for API fallbacks.
 * 2. PERMISSION ENGINE: Loads Add/Export/Timeout settings from SysUsers table.
 * 3. DYNAMIC UI: Hides/Shows buttons and menu items based on User Permissions.
 * 4. CSS OVERRIDES: Compacts GridView row numbers (52px -> 30px) and removes gaps.
 * 5. SESSION WATCHDOG: Dynamic idle timeout with countdown warning UI.
 * 6. DEV BANNER: Visual environment indicator based on document naming.
 * ==============================================================================
 */

/* eslint-env browser */
"use strict";

(function () {
  // --- PRIVATE STATE ---
  let capturedDocId = null;
  const LOG_PREFIX = "[Custom Patch]";
  const DEFAULT_TIMEOUT_MINS = 60;

  /**
   * 1. WEBSOCKET INTERCEPTION
   * Sniffs the WebSocket 'openDoc' method to grab the docId before Grist 
   * fully initializes. Crucial for early API calls.
   */
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
        console.log(`${LOG_PREFIX} 📄 docId captured from openDoc: ${capturedDocId}`);
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} ⚠️ WebSocket interception failed`, err);
    }
    return originalSend.call(this, data);
  };

  /**
   * 2. DOC ID RESOLUTION
   * Attempts to retrieve docId from Grist global or intercepted WebSocket data.
   */
  async function getDocId(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const id = window.gristDoc?.docId || capturedDocId;
      if (id) return id;
      await new Promise(r => setTimeout(r, 100));
    }
    console.warn(`${LOG_PREFIX} ❌ Could not retrieve valid docId.`);
    return null;
  }

  /**
   * 3. PERMISSION & CONFIG LOADER
   * Fetches the SysUsers table to determine user-specific UI restrictions 
   * and custom session timeout lengths.
   */
  async function getCurrentUserConfig(docId) {
    try {
      const profile = await fetch("/api/profile/user", { credentials: "include" }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: "include" });
      if (!res.ok) throw new Error("SysUsers fetch failed");

      const data = await res.json();
      const email = profile?.email?.toLowerCase();
      const userIndex = data.Email?.findIndex(e => e?.toLowerCase() === email);
      
      if (userIndex === -1 || userIndex === undefined) {
        console.log(`${LOG_PREFIX} User not found in SysUsers. Defaulting to RESTRICTED.`);
        return { canAdd: false, canExport: false, timeoutMinutes: DEFAULT_TIMEOUT_MINS };
      }

      const rawTimeout = data.Timeout_Minutes?.[userIndex];
      return {
        canAdd: data.Unlock_Structure?.[userIndex] === true,
        canExport: data.Export_Data?.[userIndex] === true,
        timeoutMinutes: (rawTimeout && Number(rawTimeout) > 0) ? Number(rawTimeout) : DEFAULT_TIMEOUT_MINS
      };
    } catch (err) {
      console.warn(`${LOG_PREFIX} ❌ Permission lookup failed`, err);
      return { canAdd: false, canExport: false, timeoutMinutes: DEFAULT_TIMEOUT_MINS };
    }
  }

  /**
   * 4. DOM OBSERVERS (UI CLOAKING)
   * These functions monitor Grist's highly dynamic DOM and remove elements 
   * the user isn't permitted to see as they appear.
   */
  function observeAndHide(selector, visible, label) {
    const apply = () => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.display = visible ? "" : "none";
      });
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  function hideInsertColumnOptions(canAlterStructure) {
    const hideIfNeeded = () => {
      document.querySelectorAll(".test-cmd-name").forEach(span => {
        const label = span.textContent?.trim();
        if (label === "Insert column to the left" || label === "Insert column to the right") {
          const li = span.closest("li");
          if (li) li.style.display = canAlterStructure ? "" : "none";
        }
      });
    };
    hideIfNeeded();
    new MutationObserver(hideIfNeeded).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 5. VISUAL OVERRIDES (CSS INJECTION)
   * Handles the GridView (30px row numbers) and GristDoc (0px padding) logic.
   */
  const injectSurgicalCSS = () => {
    if (document.getElementById("teebase-surgical-css")) return;
    const style = document.createElement("style");
    style.id = "teebase-surgical-css";
    style.textContent = `
      /* MOD DMH: GridView Row Number Reductions (52px -> 30px) */
      :root { --gridview-rownum-width: 30px !important; }
      .gridview_corner_spacer, .gridview_data_row_num, .gridview_data_corner_overlay,
      .gridview_row_numbers, .gridview_header_corner { 
        width: 30px !important; min-width: 30px !important; max-width: 30px !important; 
      }
      .gridview_header_backdrop_left { width: 31px !important; }
      .scroll_shadow_left, .scroll_shadow_frozen { left: 30px !important; }
      .frozen_line { left: calc(30px + var(--frozen-width, 0) * 1px) !important; }

      /* MOD DMH: Layout Padding & Card Compactness */
      .test-grist-doc { padding: var(--view-content-page-padding, 0px) !important; }
      .layout_box.layout_fill_window.layout_hbox, .flexvbox.view_data_pane_container, .flexvbox.detailview_single {
        padding-left: 0 !important; padding-right: 0 !important; margin-left: 0 !important; margin-right: 0 !important;
      }

      /* MOD DMH: Highlighting */
      li:focus .test-cmd-name.custom-highlight, li:focus-within .test-cmd-name.custom-highlight { color: #fff !important; }
    `;
    document.head.appendChild(style);
    console.log(`${LOG_PREFIX} Surgical CSS Injected.`);
  };

  /**
   * 6. ENHANCED IDLE SESSION TIMEOUT
   * Dynamic timeout with Warning UI and Debug Countdown.
   */
  function setupIdleTimer(timeoutMinutes) {
    if (!timeoutMinutes || timeoutMinutes < 3) timeoutMinutes = DEFAULT_TIMEOUT_MINS;
    const MS = timeoutMinutes * 60 * 1000;
    const WARNING_MS = 120000; // 2 Minutes
    const THRESHOLD = MS - WARNING_MS;
    let lastReset = Date.now();
    let idleTimer, warningTimer, debugOverlay;

    const updateDebug = () => {
      if (!debugOverlay) {
        debugOverlay = document.createElement("div");
        Object.assign(debugOverlay.style, { position: "fixed", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.8)", color: "#0f0", padding: "4px 8px", fontSize: "10px", zIndex: "999999", fontFamily: "monospace" });
        document.body.appendChild(debugOverlay);
      }
      const rem = Math.max(0, Math.floor((MS - (Date.now() - lastReset)) / 1000));
      debugOverlay.textContent = `Sess: ${rem}s`;
    };
    setInterval(updateDebug, 1000);

    const showWarning = () => {
      let warn = document.getElementById("logout-warning") || document.createElement("div");
      warn.id = "logout-warning";
      Object.assign(warn.style, { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(255, 87, 34, 0.95)", color: "white", padding: "30px", borderRadius: "10px", zIndex: "1000000", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" });
      warn.innerHTML = `<div style="font-size:24px; font-weight:bold">Session Expiring</div><div style="font-size:40px" id="warn-count">2:00</div>`;
      document.body.appendChild(warn);
      
      let sec = 120;
      const countInt = setInterval(() => {
        sec--;
        const m = Math.floor(sec/60), s = sec%60;
        document.getElementById("warn-count").innerText = `${m}:${s < 10 ? '0'+s : s}`;
        if (sec <= 0) window.location.href = "/logout";
      }, 1000);
      warn.dataset.interval = countInt;
    };

    const reset = () => {
      lastReset = Date.now();
      const warn = document.getElementById("logout-warning");
      if (warn) { warn.style.display = "none"; clearInterval(warn.dataset.interval); }
      clearTimeout(idleTimer); clearTimeout(warningTimer);
      warningTimer = setTimeout(showWarning, THRESHOLD);
      idleTimer = setTimeout(() => window.location.href = "/logout", MS);
    };

    ["mousedown", "keydown", "touchstart"].forEach(e => document.addEventListener(e, reset, { capture: true }));
    reset();
  }

  /**
   * 7. DEPLOYMENT & BOOTSTRAP
   * Orchestrates the startup sequence.
   */
  const bootSystem = async () => {
    console.log(`${LOG_PREFIX} v2.2.0 Hardened Boot Initiated...`);
    
    // Static Overrides
    injectSurgicalCSS();
    
    const docId = await getDocId();
    if (docId) {
      const config = await getCurrentUserConfig(docId);
      
      // Permission Based UI
      observeAndHide(".mod-add-column", config.canAdd, "Add Column");
      observeAndHide(".test-tb-share", config.canExport, "Share Icon");
      observeAndHide(".test-download-section", config.canExport, "Export Menu");
      hideInsertColumnOptions(config.canExport);

      // Feature Highlighting
      const highlight = (label, color = "red") => {
        document.querySelectorAll(".test-cmd-name").forEach(span => {
          if (span.textContent?.trim() === label) {
            span.classList.add("custom-highlight");
            span.style.color = color;
            span.style.fontWeight = "bold";
          }
        });
      };
      const obs = new MutationObserver(() => {
        highlight("Delete widget"); highlight("Delete record"); highlight("Delete");
      });
      obs.observe(document.body, { childList: true, subtree: true });

      // Session Management
      setupIdleTimer(config.timeoutMinutes);

      // Dev Banner logic
      const docMeta = await fetch(`/api/docs/${docId}`, { credentials: "include" }).then(r => r.json());
      if (docMeta.name?.includes("- DEV")) {
        const b = document.createElement("div");
        b.innerText = "DEV ENVIRONMENT";
        Object.assign(b.style, { position: "fixed", top: "0", left: "0", width: "100%", height: "10px", background: "#f48fb1", fontSize: "10px", textAlign: "center", zIndex: "99999", fontWeight: "bold" });
        document.body.prepend(b);
        document.body.style.marginTop = "10px";
      }
    } else {
      setupIdleTimer(DEFAULT_TIMEOUT_MINS); // Fallback timer
    }
  };

  window.addEventListener("load", bootSystem);

})();
