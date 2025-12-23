/* eslint-env browser */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.6.1");

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

  // === 3. Load current user's permissions from SysUsers table in the current document ===
  async function getCurrentUserPermissions(docId) {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });
      if (!res.ok) throw new Error("SysUsers fetch failed");

      const data = await res.json();
      const email = profile?.email?.toLowerCase();
      const userIndex = data.Email?.findIndex(e => e?.toLowerCase() === email);
      if (userIndex === -1) {
        console.log("[Custom Patch] User not found in SysUsers table. All permissions denied.");
        return { canAdd: false, canExport: false };
      }

      const canAdd = data.Unlock_Structure?.[userIndex] === true;
      const canExport = data.Export_Data?.[userIndex] === true;

      console.log(`[Custom Patch] Permissions for ${email}: Add Column = ${canAdd}, Export = ${canExport}`);
      return { canAdd, canExport };
    } catch (err) {
      console.warn("[Custom Patch] ❌ Permission lookup failed", err);
      return { canAdd: false, canExport: false };
    }
  }

  // === 4. Observe the DOM for specific UI elements and hide/show based on permissions ===
  function observeAndHide(selector, visible, label) {
    const apply = () => {
      const found = document.querySelectorAll(selector);
      if (!visible && found.length) {
        found.forEach(el => el.style.display = 'none');
        console.log(`[Custom Patch] Hiding ${label} (${selector}) due to permission restriction.`);
      } else if (visible && found.length) {
        found.forEach(el => el.style.display = '');
        console.log(`[Custom Patch] Showing ${label} (${selector}) as user has permission.`);
      }
    };
    apply();
    new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
  }

  // === 5. Show/Hide "Insert column to the left/right" in column menu based on canAlterStructure permission ===
  function hideInsertColumnOptions(canAlterStructure) {
    const hideIfNeeded = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        const label = span.textContent?.trim();
        if (label === 'Insert column to the left' || label === 'Insert column to the right') {
          const li = span.closest('li');
          if (li) {
            if (!canAlterStructure) {
              li.style.display = 'none';
              console.log(`[Custom Patch] Hiding column menu option: ${label} (no canAlterStructure permission)`);
            } else {
              li.style.display = '';
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
    if (!document.getElementById('custom-focus-style')) {
      const style = document.createElement('style');
      style.id = 'custom-focus-style';
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
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        if (span.textContent?.trim() === 'Delete widget') {
          span.classList.add('custom-highlight');
          span.style.color = 'red'; // Red in normal state
          span.style.fontWeight = 'bold';
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 8. Highlight "Delete" and "Delete record" menu options ===
  function highlightDeleteRecord() {
    const highlight = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        const label = span.textContent?.trim();
        if (label === 'Delete record' || label === 'Delete') {
          span.classList.add('custom-highlight');
          span.style.color = 'red'; // Red in normal state
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 9. Main logic: Apply all visibility controls after permissions are loaded ===
  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) return;

    const perms = await getCurrentUserPermissions(docId);

    observeAndHide('.mod-add-column', perms.canAdd, 'Add Column Button');
    observeAndHide('.test-tb-share', perms.canExport, 'Share Icon');
    observeAndHide('.test-download-section', perms.canExport, 'Download/Export Option');
    hideInsertColumnOptions(perms.canExport);
    highlightDeleteWidget();
    highlightDeleteRecord();
    addFocusStyle();
  }

  // === 10. DEV banner: show a 10px banner at top if doc name contains "- DEV" ===
  async function maybeShowDevBanner() {
    const docId = await getDocId();
    if (!docId) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.name && data.name.includes('- DEV')) {
        if (!document.getElementById('custom-global-banner')) {
          const banner = document.createElement('div');
          banner.id = 'custom-global-banner';
          banner.innerText = 'DEV ENVIRONMENT – This is a test document';
          Object.assign(banner.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '10px',
            background: '#f48fb1',
            color: '#333',
            fontWeight: 'bold',
            fontSize: '10px',
            textAlign: 'center',
            lineHeight: '10px',
            letterSpacing: '1px',
            zIndex: '9999',
            overflow: 'hidden',
            whiteSpace: 'nowrap'
          });
          document.body.prepend(banner);
          document.body.style.marginTop = '10px';
          console.log("[Custom Patch] DEV banner displayed.");
        }
      }
    } catch (err) {
      console.warn("[Custom Patch] ❌ DEV banner logic failed", err);
    }
  }

  // === 11. Idle Session Timeout: Monitor activity and force logout ===
  function setupIdleTimer() {
    const IDLE_TIMEOUT_MS = 120000;      // 2 Minutes (Test)
    const WARNING_THRESHOLD_MS = 90000;  // 1.5 Minutes (Test)
    const LOGOUT_URL = '/logout'; 
    
    let idleTimer;
    let warningTimer;

    const hideWarning = () => {
      const warningDiv = document.getElementById('logout-warning');
      if (warningDiv) warningDiv.style.display = 'none';
    };

    const logoutUser = () => {
      console.log("🚨 [Custom Patch] Idle timeout reached. Redirecting to logout.");
      window.location.href = LOGOUT_URL;
    };

    const showWarning = () => {
      console.log("⚠️ [Custom Patch] Showing inactivity warning.");
      let warningDiv = document.getElementById('logout-warning');
      if (!warningDiv) {
        warningDiv = document.createElement('div');
        warningDiv.id = 'logout-warning';
        Object.assign(warningDiv.style, {
          position: 'fixed', bottom: '20px', right: '20px', 
          background: '#ff9800', color: 'white', padding: '15px', 
          borderRadius: '5px', zIndex: '99999', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
          fontFamily: 'sans-serif', pointer-events: 'none'
        });
        warningDiv.innerHTML = "<strong>Session Warning:</strong> Inactivity detected. Logging out in 30 seconds.";
        document.body.appendChild(warningDiv);
      }
      warningDiv.style.display = 'block';
    };

    const resetTimers = () => {
      clearTimeout(idleTimer);
      clearTimeout(warningTimer);
      hideWarning();
      
      warningTimer = setTimeout(showWarning, WARNING_THRESHOLD_MS);
      idleTimer = setTimeout(logoutUser, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(name => {
      document.addEventListener(name, resetTimers, { capture: true, passive: true });
    });

    resetTimers();
    console.log("[Custom Patch] ✅ Idle Timer logic fully initialized.");
  }

  // === 12. Run everything on window load ===
  window.addEventListener('load', () => {
    console.log("[Custom Patch] ⏳ window.onload triggered");
    
    // START TIMER FIRST (No async/network dependencies)
    setupIdleTimer();
    
    // RUN UI PATCHES SECOND (Async/Network dependencies)
    applyVisibilityControls();
    maybeShowDevBanner();
  });
})();
