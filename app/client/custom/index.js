/* eslint-env browser */

"use strict";

/*===================================================================================
  Custom Patch: Role-Based UI Access Control for Grist

  Purpose:
    Restricts visibility and access to sensitive UI actions in Grist (Add Column, Share, Download)
    based on per-user permissions set in the SysUsers table of the current document.
    Also displays a 10px pink banner at the top for documents with "- DEV" in the name.
    Hides "Insert column to the left" and "Insert column to the right" menu options
    in the column header dropdown if user lacks Export_Data permission.
    Highlights all "Delete widget" menu options in all widgets (Card, Table, etc.) in red and italics
    to reduce the risk of accidental selection.

  Features:
    - Hides “Add Column” (“+”) button if the user does not have Unlock_Structure = true.
    - Hides “Share” icon if the user does not have Export_Data = true.
    - Hides “Download/Export” options if the user does not have Export_Data = true.
    - Hides "Insert column to the left/right" menu items in the column menu if user lacks Export_Data = true.
    - Styles all "Delete widget" menu options (across all widgets) in red italic bold to make them visually distinct and reduce accidental deletion risk.
    - Permissions are dynamically loaded and enforced every time the page loads.
    - Shows a 10px high pink banner with a message at the top if document name contains "- DEV".

  Implementation:
    - Captures the current docId as soon as possible (even if Grist is slow to set it)
    - Loads the current user's permissions from SysUsers
    - Uses MutationObservers to continually hide/show elements as the UI updates
    - Uses the Grist API to get the document name and displays the DEV banner if needed

  Version: v1.5.0
===================================================================================*/

console.log("[Custom Patch] index.js loaded ✅ v1.5.0");

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

  // === 5. Hide "Insert column to the left/right" in column menu if user lacks Export_Data permission ===
  /**
   * Hides "Insert column to the left" and "Insert column to the right" menu items
   * from all Grist column header dropdown menus if `allowed` is false.
   * Uses MutationObserver to watch for menu re-renders.
   *
   * @param {boolean} allowed - Whether the user has Export_Data permission
   */
  function hideInsertColumnOptions(allowed) {
    const hideIfNeeded = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        const label = span.textContent?.trim();
        if (
          (label === 'Insert column to the left' || label === 'Insert column to the right') &&
          !allowed
        ) {
          const li = span.closest('li');
          if (li && li.style.display !== 'none') {
            li.style.display = 'none';
            console.log(`[Custom Patch] Hiding column menu option: ${label} (no Export_Data permission)`);
          }
        }
      });
    };
    hideIfNeeded();
    new MutationObserver(hideIfNeeded).observe(document.body, { childList: true, subtree: true });
  }

  // === 6. Highlight all "Delete widget" menu options across all widgets ===
  /**
   * Highlights all "Delete widget" menu options (Card, Table, etc.) in red and italics,
   * to warn users and help prevent accidental deletion.
   * Uses MutationObserver to apply the style every time the menu is rendered.
   */
  function highlightDeleteWidget() {
    const highlight = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        if (span.textContent?.trim() === 'Delete widget') {
          span.style.color = 'red';
          span.style.fontStyle = 'italic';
          span.style.fontWeight = 'bold';
          // Optionally add a warning emoji:
          // if (!span.innerText.startsWith('⚠️ ')) span.innerText = "⚠️ " + span.innerText;
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 7. Main logic: Apply all visibility controls after permissions are loaded ===
  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) return;

    const perms = await getCurrentUserPermissions(docId);

    // --- HIDE/SHOW ADD COLUMN BUTTON ---
    observeAndHide('.mod-add-column', perms.canAdd, 'Add Column Button');

    // --- HIDE/SHOW SHARE ICON ---
    observeAndHide('.test-tb-share', perms.canExport, 'Share Icon');

    // --- HIDE/SHOW DOWNLOAD/EXPORT OPTIONS ---
    observeAndHide('.test-download-section', perms.canExport, 'Download/Export Option');

    // --- HIDE/SHOW INSERT COLUMN MENU OPTIONS ---
    hideInsertColumnOptions(perms.canExport);

    // --- STYLE ALL "DELETE WIDGET" MENU OPTIONS ---
    highlightDeleteWidget();
  }

  // === 8. DEV banner: show a 10px banner at top if doc name contains "- DEV" ===
  async function maybeShowDevBanner() {
    const docId = await getDocId();
    if (!docId) return;
    try {
      const res = await fetch(`/api/docs/${docId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.name && data.name.includes('- DEV')) {
        // Insert banner if not already present
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
          console.log("[Custom Patch] DEV banner displayed (document name includes '- DEV').");
        }
      } else {
        console.log("[Custom Patch] DEV banner not displayed (document name does not include '- DEV').");
      }
    } catch (err) {
      console.warn("[Custom Patch] ❌ DEV banner logic failed", err);
    }
  }

  // === 9. Run everything on window load ===
  window.addEventListener('load', () => {
    console.log("[Custom Patch] ⏳ window.onload fallback triggered");
    applyVisibilityControls();
    maybeShowDevBanner();
  });
})();
