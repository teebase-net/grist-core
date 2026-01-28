/* eslint-env browser */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.7.10-TimeoutUpdate");

(function () {
  let capturedDocId = null;

  // === 1. Capture docId from Grist’s WebSocket as soon as it’s available ===
  const originalSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const msg = JSON.parse(data);
      if (msg?.method === "openDoc" && msg.args?.length) {
        capturedDocId = msg.args[0];
        console.log(`[Custom Patch] 📄 docId captured from openDoc: ${capturedDocId}`);
      }
    } catch (err) {
      console.warn("[Custom Patch] ⚠️ WebSocket interception failed", err);
    }
    return originalSend.call(this, data);
  };

  // === 2. Wait for docId to be available, either from Grist or via WebSocket sniffing ===
  async function getDocId(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const id = window.gristDoc?.docId || capturedDocId;
      if (id) return id;
      await new Promise(r => setTimeout(r, 100));
    }
    console.warn("[Custom Patch] ❌ Could not retrieve valid docId — skipping fallback.");
    return null;
  }

  // === 3. Load permissions AND Timeout from SysUsers table ===
  async function getCurrentUserPermissions(docId) {
    const DEFAULT_TIMEOUT = 60; // Default minutes if not found
    try {
      const profile = await fetch("/api/profile/user", { credentials: "include" }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: "include" });
      if (!res.ok) throw new Error("SysUsers fetch failed");

      const data = await res.json();
      const email = profile?.email?.toLowerCase();
      const userIndex = data.Email?.findIndex(e => e?.toLowerCase() === email);
      
      if (userIndex === -1) {
        console.log("[Custom Patch] User not found in SysUsers table. All permissions denied. Defaulting timeout.");
        return { canAdd: false, canExport: false, timeoutMinutes: DEFAULT_TIMEOUT };
      }

      const canAdd = data.Unlock_Structure?.[userIndex] === true;
      const canExport = data.Export_Data?.[userIndex] === true;
      
      // NEW: Grab Timeout_Minutes (Column ID: Timeout_Minutes). Default to 60 if 0/null/undefined.
      let rawTimeout = data.Timeout_Minutes?.[userIndex];
      const timeoutMinutes = (rawTimeout && Number(rawTimeout) > 0) ? Number(rawTimeout) : DEFAULT_TIMEOUT;

      console.log(`[Custom Patch] Config for ${email}: Add=${canAdd}, Export=${canExport}, Timeout=${timeoutMinutes}m`);
      return { canAdd, canExport, timeoutMinutes };
    } catch (err) {
      console.warn("[Custom Patch] ❌ Permission/Config lookup failed", err);
      return { canAdd: false, canExport: false, timeoutMinutes: DEFAULT_TIMEOUT };
    }
  }

  // === 4. Observe the DOM for specific UI elements and hide/show based on permissions ===
  function observeAndHide(selector, visible, label) {
    const apply = () => {
      const found = document.querySelectorAll(selector);
      if (!visible && found.length) {
        found.forEach(el => el.style.display = "none");
        console.log(`[Custom Patch] Hiding ${label} (${selector}) due to permission restriction.`);
      } else if (visible && found.length) {
        found.forEach(el => el.style.display = "");
        console.log(`[Custom Patch] Showing ${label} (${selector}) as user has permission.`);
      }
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  // === 5. Show/Hide "Insert column to the left/right" in column menu based on canAlterStructure permission ===
  function hideInsertColumnOptions(canAlterStructure) {
    const hideIfNeeded = () => {
      document.querySelectorAll(".test-cmd-name").forEach(span => {
        const label = span.textContent?.trim();
        if (label === "Insert column to the left" || label === "Insert column to the right") {
          const li = span.closest("li");
          if (li) {
            if (!canAlterStructure) {
              li.style.display = "none";
              console.log(`[Custom Patch] Hiding column menu option: ${label} (no canAlterStructure permission)`);
            } else {
              li.style.display = "";
              console.log(`[Custom Patch] Showing column menu option: ${label} (has canAlterStructure permission)`);
            }
          }
        }
      });
    };
    hideIfNeeded();
    new MutationObserver(hideIfNeeded).observe(document.body, { childList: true, subtree: true });
  }

  // === 6. Add CSS rule for focus styling ===
  function addFocusStyle() {
    if (!document.getElementById("custom-focus-style")) {
      const style = document.createElement("style");
      style.id = "custom-focus-style";
      style.textContent = `
        li:focus .test-cmd-name.custom-highlight,
        li:focus-within .test-cmd-name.custom-highlight {
          color: #fff !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // === 7. Highlight all "Delete widget" menu options across all widgets ===
  function highlightDeleteWidget() {
    const highlight = () => {
      document.querySelectorAll(".test-cmd-name").forEach(span => {
        if (span.textContent?.trim() === "Delete widget") {
          span.classList.add("custom-highlight");
          span.style.color = "red"; // Red in normal state
          span.style.fontWeight = "bold";
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 8. Highlight "Delete" and "Delete record" menu options ===
  function highlightDeleteRecord() {
    const highlight = () => {
      document.querySelectorAll(".test-cmd-name").forEach(span => {
        const label = span.textContent?.trim();
        if (label === "Delete record" || label === "Delete") {
          span.classList.add("custom-highlight");
          span.style.color = "red"; // Red in normal state
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 9. Main logic: Apply all visibility controls after permissions are loaded ===
  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) {
      // Fallback: If no docId, ensure at least the default timer runs
      setupIdleTimer(60); 
      return;
    }

    const perms = await getCurrentUserPermissions(docId);

    // Apply Permissions
    observeAndHide(".mod-add-column", perms.canAdd, "Add Column Button");
    observeAndHide(".test-tb-share", perms.canExport, "Share Icon");
    observeAndHide(".test-download-section", perms.canExport, "Download/Export Option");
    hideInsertColumnOptions(perms.canExport);

    // Initialize Timer with dynamic value
    setupIdleTimer(perms.timeoutMinutes);

    // Apply other visuals
    highlightDeleteWidget();
    highlightDeleteRecord();
    addFocusStyle();
  }

  // === 10. DEV banner: show a 10px banner at top if doc name contains "- DEV" ===
  async function maybeShowDevBanner() {
    const docId = await getDocId();
    if (!docId) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.name && data.name.includes("- DEV")) {
        if (!document.getElementById("custom-global-banner")) {
          const banner = document.createElement("div");
          banner.id = "custom-global-banner";
          banner.innerText = "DEV ENVIRONMENT – This is a test document";
          Object.assign(banner.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "10px",
            background: "#f48fb1",
            color: "#333",
            fontWeight: "bold",
            fontSize: "10px",
            textAlign: "center",
            lineHeight: "10px",
            letterSpacing: "1px",
            zIndex: "9999",
            overflow: "hidden",
            whiteSpace: "nowrap"
          });
          document.body.prepend(banner);
          document.body.style.marginTop = "10px";
          console.log("[Custom Patch] DEV banner displayed (document name includes '- DEV').");
        }
      }
    } catch (err) {
      console.warn("[Custom Patch] ❌ DEV banner logic failed", err);
    }
  }

// === 11. Enhanced Idle Session Timeout (Click-only + Diagnostics) ===
function setupIdleTimer(timeoutMinutes) {
  // Validate input (min 3 minutes), default to 60 if missing
  if (!timeoutMinutes || timeoutMinutes < 3) timeoutMinutes = 60;

  const IDLE_TIMEOUT_MS = timeoutMinutes * 60 * 1000;
  const WARNING_DURATION_MS = 2 * 60 * 1000; // 2 minutes
  const WARNING_THRESHOLD_MS = IDLE_TIMEOUT_MS - WARNING_DURATION_MS;
  const LOGOUT_URL = "/logout";

  let idleTimer;
  let warningTimer;
  let countdownInterval;
  let lastReset = Date.now();
  let debugOverlay;

  const log = (...args) => console.log("[IdleTimer]", ...args);

  log(`Initialized: timeout=${timeoutMinutes}m`);

  // === Debug overlay (floating countdown) ===
  const updateDebugOverlay = () => {
    if (!debugOverlay) {
      debugOverlay = document.createElement("div");
      Object.assign(debugOverlay.style, {
        position: "fixed",
        bottom: "10px",
        right: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "#0f0",
        padding: "6px 10px",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 999999
      });
      document.body.appendChild(debugOverlay);
    }

    const remaining =
      Math.max(0, Math.floor((IDLE_TIMEOUT_MS - (Date.now() - lastReset)) / 1000));

    debugOverlay.textContent = `Idle logout in: ${remaining}s`;
  };

  setInterval(updateDebugOverlay, 1000);

  // === Warning UI ===
  const hideWarning = () => {
    const warningDiv = document.getElementById("logout-warning");
    if (warningDiv) warningDiv.style.display = "none";
    clearInterval(countdownInterval);
  };

  const logoutUser = () => {
    log("⛔ Idle timeout reached → redirecting to logout");
    window.location.href = LOGOUT_URL;
  };

  const startCountdown = (secondsRemaining) => {
    const countdownSpan = document.getElementById("logout-countdown");
    clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      secondsRemaining--;

      if (countdownSpan) {
        const mins = Math.floor(secondsRemaining / 60);
        const secs = secondsRemaining % 60;
        countdownSpan.textContent =
          `${mins}:${secs.toString().padStart(2, "0")}`;
      }

      if (secondsRemaining <= 0) {
        clearInterval(countdownInterval);
        logoutUser();
      }
    }, 1000);
  };

  const showWarning = () => {
    log("⚠️ Showing inactivity warning");

    let warningDiv = document.getElementById("logout-warning");
    if (!warningDiv) {
      warningDiv = document.createElement("div");
      warningDiv.id = "logout-warning";
      Object.assign(warningDiv.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(255, 152, 0, 0.95)",
        color: "white",
        padding: "40px 60px",
        borderRadius: "15px",
        zIndex: 100000,
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
        fontFamily: "sans-serif",
        textAlign: "center"
      });

      warningDiv.innerHTML = `
        <div style="font-size:32px;font-weight:bold;margin-bottom:15px;">
          Session Expiring
        </div>
        <div style="font-size:18px;margin-bottom:20px;">
          You will be logged out due to inactivity in:
        </div>
        <div id="logout-countdown"
             style="font-size:48px;font-weight:800;font-family:monospace;">
          2:00
        </div>
      `;

      document.body.appendChild(warningDiv);
    }

    warningDiv.style.display = "block";
    startCountdown(WARNING_DURATION_MS / 1000);
  };

  // === Timer reset ===
  const resetTimers = (e) => {
    log("Activity:", e?.type);

    lastReset = Date.now();

    const warningDiv = document.getElementById("logout-warning");
    if (warningDiv && warningDiv.style.display === "block") {
      log("Warning dismissed due to activity");
      hideWarning();
    }

    clearTimeout(idleTimer);
    clearTimeout(warningTimer);

    log("Timers armed");

    warningTimer = setTimeout(showWarning, WARNING_THRESHOLD_MS);
    idleTimer = setTimeout(logoutUser, IDLE_TIMEOUT_MS);
  };

  // === CLICK-ONLY activity tracking ===
  ["mousedown", "keydown", "touchstart"].forEach(event =>
    document.addEventListener(event, resetTimers, { capture: true })
  );

  resetTimers();
}


// === 12. GridView Overrides: Narrow Row Numbers (Migrated from GridView.css) ===
  /**
   * PURPOSE: Reduces row-number column width from 52px to 30px for a more compact UI.
   * Targets: .gridview_row_numbers, .gridview_corner_spacer, and related overlay offsets.
   */
  function injectGridViewStyles() {
    if (document.getElementById("custom-gridview-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-gridview-styles";
    style.textContent = `
      /* MOD DMH: Define the 30px width variable */
      :root {
        --gridview-rownum-width: 30px !important;
      }

      /* 1. Corner Spacers and Row Numbers */
      .gridview_corner_spacer,
      .gridview_data_row_num,
      .gridview_data_corner_overlay {
        width: 30px !important;
        min-width: 30px !important;
      }

      /* 2. Backdrop and Offset calculations */
      .gridview_header_backdrop_left {
        width: 31px !important; /* width + 1px border */
      }

      .scroll_shadow_left,
      .scroll_shadow_frozen {
        left: 30px !important;
      }

      .frozen_line {
        left: calc(30px + var(--frozen-width, 0) * 1px) !important;
      }

      /* 3. Printing adjustments */
      @media print {
        .print-widget .gridview_data_header {
          padding-left: 30px !important;
        }
      }

      /* 4. Sticky positioning for frozen columns */
      .record .field.frozen {
        left: calc(30px + 1px + (var(--frozen-position, 0) - var(--frozen-offset, 0)) * 1px) !important;
      }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] GridView (Row Number) styles injected.");
  }

  // === 13. GristDoc Overrides: Layout Padding (Migrated from GristDoc.ts) ===
  /**
   * PURPOSE: Removes the 12px gap above the green line in the Layout Tray 
   * and removes the border around the main body to save screen space.
   * Targets: .test-grist-doc (the class associated with cssViewContentPane)
   */
  function injectGristDocStyles() {
    if (document.getElementById("custom-gristdoc-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-gristdoc-styles";
    style.textContent = `
      /* MOD DMH: Force padding to 0px to remove body borders and top gaps */
      .test-grist-doc {
        padding: var(--view-content-page-padding, 0px) !important;
      }

      /* Ensure small screens still respect a minimum manageable padding */
      @media (max-width: 768px) {
        .test-grist-doc {
          padding: 4px !important;
        }
      }

      /* Maintain 0px padding for special pages and print mode */
      .test-grist-doc-special-page,
      @media print {
        .test-grist-doc {
          padding: 0px !important;
        }
      }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] GristDoc (Layout Padding) styles injected.");
  }

  // === 14. GridView.ts Override: Row Width Constant (Standalone) ===
  /**
   * PURPOSE: Overrides the visual manifestation of the ROW_NUMBER_WIDTH constant.
   * Targets the 52px to 30px reduction for row headers and frozen column offsets.
   */
  function injectGridViewConstantOverrides() {
    if (document.getElementById("custom-gridview-ts-overrides")) return;
    const style = document.createElement("style");
    style.id = "custom-gridview-ts-overrides";
    style.textContent = `
      /* MOD DMH: Force row number width to 30px */
      .gridview_row_numbers, 
      .gridview_header_corner {
        width: 30px !important;
        min-width: 30px !important;
        max-width: 30px !important;
      }

      /* MOD DMH: Re-calculate frozen column positioning for 30px start */
      .gridview_row .record .field.frozen {
        left: calc(30px + (var(--frozen-width-prefix, 0) * 1px)) !important;
      }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] GridView.ts constant override (30px) injected.");
  }

  // === 15. DetailView.css Overrides: Compact Card Layout (Standalone) ===
  /**
   * PURPOSE: Tightens the Card/Detail widget layout by removing horizontal padding and margins.
   * Migrated from DetailView.css.
   */
  function injectDetailViewStyles() {
    if (document.getElementById("custom-detailview-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-detailview-styles";
    style.textContent = `
      /* MOD DMH: Make Card widget padding uniform and remove horizontal gaps */
      .layout_box.layout_fill_window.layout_hbox,
      .flexvbox.view_data_pane_container,
      .flexvbox.detailview_single {
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
    `;
    document.head.appendChild(style);
    console.log("[Custom Patch] DetailView compact layout styles injected.");
  }


// === 99. Run everything on window load ===
  /**
   * Keep this at the very bottom of index.js.
   * Executes all surgical patches and logic once the DOM and resources are ready.
   */
  window.addEventListener("load", () => {
    console.log("[Custom Patch] ⏳ window.onload triggered");
    
    // 1. Static UI & CSS Overrides (No dependencies)
    injectGridViewStyles();           // Ported from GridView.css (30px UI)
    injectGristDocStyles();          // Ported from GristDoc.ts (0px Padding)
    injectGridViewConstantOverrides(); // Ported from GridView.ts (Width Overrides)
    injectDetailViewStyles();        // Ported from DetailView.css (Compact Cards)
    
    // 2. Data-Dependent Overrides (Requires docId/API access)
    // IMPORTANT: This now handles Permissions AND the Timeout Config
    applyVisibilityControls();
    
    maybeShowDevBanner();
  });
  
//end  
})();
