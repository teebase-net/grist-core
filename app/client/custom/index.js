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
  function highlightDeleteWidget() {
    const highlight = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        if (span.textContent?.trim() === 'Delete widget') {
          span.style.color = 'red';
          span.style.fontStyle = 'italic';
          span.style.fontWeight = 'bold';
        }
      });
    };
    highlight();
    new MutationObserver(highlight).observe(document.body, { childList: true, subtree: true });
  }

  // === 7. Hide elements from LabelBlock widgets unless owner with Unlock_Structure ===
function hideLabelBlockControls() {
  const isOwner = window.gristDoc?.app?.currentUser?.access === 'owners';
  const unlockStructure = window.gristDoc?.app?.model?.docInfo?.unlock_structure;

  if (isOwner && unlockStructure) {
    console.log("[LabelBlock Patch] 🛑 User is owner with unlock_structure: no hiding applied.");
    return;
  }

  const labelBlockIframes = [...document.querySelectorAll('iframe[src*="widgets.teebase.net/labelblock"]')];
  console.log(`[LabelBlock Patch] Found ${labelBlockIframes.length} labelblock widget(s).`);

  for (const iframe of labelBlockIframes) {
    let widgetBox = iframe.parentElement;
    while (widgetBox && !widgetBox.classList.contains('test-widget')) {
      widgetBox = widgetBox.parentElement;
    }
    if (!widgetBox) continue;

    // 1. Widget title
    const titleEl = widgetBox.querySelector('.test-widget-title-text');
    if (titleEl) {
      titleEl.style.display = 'none';
      console.log("[LabelBlock Patch] Hiding widget title.");
    }

    // 2. Filter dropdown
    const filterBtn = widgetBox.querySelector('.test-filter-field');
    if (filterBtn) {
      filterBtn.style.display = 'none';
      console.log("[LabelBlock Patch] Hiding filter button.");
    }

    // 3. Filter icon
    const filterIcon = widgetBox.querySelector('.test-section-menu-sortAndFilter');
    if (filterIcon) {
      filterIcon.style.display = 'none';
      console.log("[LabelBlock Patch] Hiding filter icon.");
    }

    // 4. Dots menu
    const layoutMenu = widgetBox.querySelector('.test-section-menu-viewLayout');
    if (layoutMenu) {
      layoutMenu.style.display = 'none';
      console.log("[LabelBlock Patch] Hiding layout (dots) menu.");
    }
  }
}

// === Polling strategy to wait for iframe to load ===
(function pollForLabelBlock(retries = 10) {
  const labelBlockIframes = [...document.querySelectorAll('iframe[src*="widgets.teebase.net/labelblock"]')];
  console.log(`[LabelBlock Patch] Polling... found ${labelBlockIframes.length} iframe(s).`);
  if (labelBlockIframes.length > 0) {
    hideLabelBlockControls();
  } else if (retries > 0) {
    setTimeout(() => pollForLabelBlock(retries - 1), 500);
  } else {
    console.warn("[LabelBlock Patch] ❌ Timed out waiting for labelblock widget.");
  }
})();

// === Fallback: MutationObserver for future widgets ===
const observer = new MutationObserver(hideLabelBlockControls);
observer.observe(document.body, { childList: true, subtree: true });
// end MOD DMH
  // === 8. Main logic: Apply all visibility controls after permissions are loaded ===
  async function applyVisibilityControls() {
    const docId = await getDocId();
    if (!docId) return;

    const perms = await getCurrentUserPermissions(docId);

    observeAndHide('.mod-add-column', perms.canAdd, 'Add Column Button');
    observeAndHide('.test-tb-share', perms.canExport, 'Share Icon');
    observeAndHide('.test-download-section', perms.canExport, 'Download/Export Option');
    hideInsertColumnOptions(perms.canExport);
    highlightDeleteWidget();
    hideLabelBlockControls(perms.canAdd);
  }

  // === 9. DEV banner: show a 10px banner at top if doc name contains "- DEV" ===
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
          console.log("[Custom Patch] DEV banner displayed (document name includes '- DEV').");
        }
      } else {
        console.log("[Custom Patch] DEV banner not displayed (document name does not include '- DEV').");
      }
    } catch (err) {
      console.warn("[Custom Patch] ❌ DEV banner logic failed", err);
    }
  }

  // === 10. Run everything on window load ===
  window.addEventListener('load', () => {
    console.log("[Custom Patch] ⏳ window.onload fallback triggered");
    applyVisibilityControls();
    maybeShowDevBanner();
  });
})();
