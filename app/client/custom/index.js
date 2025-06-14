/* eslint-env browser */

// == Custom Patch: index.js override ==
// Version: v1.5.2
// Purpose: Enforce UI restrictions and tweaks based on SysUsers table permissions.
//
// Features:
// 1. Hide Add Column button if user lacks Unlock_Structure permission.
// 2. Hide Share icon and Export options if user lacks Export_Data permission.
// 3. Hide "Insert column to left/right" menu options based on Export_Data.
// 4. Style "Delete Widget" menu options with a red highlight.
// 5. Show "DEV" banner if document name includes "- DEV".
// 6. Capture docId and permissions before running UI logic.
// 7. Hide specific UI elements in LabelBlock widgets unless Unlock_Structure is true.

(function () {
  console.log("[Custom Patch] index.js loaded ✅ v1.5.2");

  // === 1. Capture Grist document ID from openDoc ===
  let docId = null;
  const origOpenDoc = window.openDoc;
  window.openDoc = function(...args) {
    if (args[0]) {
      docId = args[0];
      console.log(`[Custom Patch] 📄 docId captured from openDoc: ${docId}`);
    }
    return origOpenDoc.apply(this, args);
  };

  // === 2. Utility: Wait for DOM element ===
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        reject(`Timeout waiting for ${selector}`);
      }, timeout);
    });
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

  // === 4. Generic DOM observer to hide elements ===
  function observeAndHide(selector, condition, label) {
    const hideIfNeeded = () => {
      const el = document.querySelector(selector);
      if (el) {
        el.style.display = condition ? '' : 'none';
        if (!condition) {
          console.log(`[Custom Patch] Hiding ${label} (${selector}) due to permission restriction.`);
        }
      }
    };
    hideIfNeeded();
    new MutationObserver(hideIfNeeded).observe(document.body, { childList: true, subtree: true });
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

  // === 6. Style "Delete Widget" menu options ===
  function highlightDeleteWidget() {
    const styleIfNeeded = () => {
      document.querySelectorAll('.test-cmd-name').forEach(span => {
        const label = span.textContent?.trim();
        if (label === 'Delete widget') {
          span.style.color = 'crimson';
        }
      });
    };
    styleIfNeeded();
    new MutationObserver(styleIfNeeded).observe(document.body, { childList: true, subtree: true });
  }

  // === 7. LabelBlock-specific logic ===
  function applyLabelBlockPatch(unlockStructure) {
    const shouldHide = !unlockStructure;
    if (!shouldHide) {
      console.log("[LabelBlock Patch] 🛑 Unlock_Structure is true: no elements will be hidden.");
      return;
    }

    function hideLabelElements() {
      const widgets = document.querySelectorAll('.test-viewlayout-section-390');
      console.log(`[LabelBlock Patch] Found ${widgets.length} labelblock widget(s).`);
      widgets.forEach(widget => {
        const iframe = widget.querySelector('iframe[src*="labelblock"]');
        if (!iframe) return;

        const selectors = [
          '.test-widget-title-text',
          '.test-filter-field',
          '.test-section-menu-sortAndFilter',
          '.test-section-menu-viewLayout',
          '.test-add-filter-btn'
        ];

        for (const sel of selectors) {
          const el = widget.querySelector(sel);
          if (el) {
            el.style.display = 'none';
            console.log(`[LabelBlock Patch] Hiding element: ${sel}`);
          }
        }
      });
    }

    // Run initially and attach MutationObserver
    hideLabelElements();
    const observer = new MutationObserver(() => {
      console.log("[LabelBlock Patch] DOM changed, re-checking for labelblock widgets...");
      hideLabelElements();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // === 8. Show DEV banner if document name includes "- DEV" ===
  function showDevBannerIfApplicable() {
    const nameEl = document.querySelector('.test-doc-name');
    const name = nameEl?.textContent?.trim();
    if (name && name.includes('- DEV')) {
      const banner = document.createElement('div');
      banner.textContent = 'DEV MODE';
      banner.style = 'position:fixed;top:0;left:0;right:0;padding:6px;background:#ff4747;color:white;text-align:center;font-weight:bold;z-index:10000;';
      document.body.appendChild(banner);
      console.log("[Custom Patch] 🚨 DEV banner displayed.");
    } else {
      console.log("[Custom Patch] DEV banner not displayed (document name does not include '- DEV').");
    }
  }

  // === 9. Main logic: Apply all visibility controls after permissions are loaded ===
  async function applyVisibilityControls() {
    const id = docId || await new Promise(resolve => {
      window.addEventListener('load', () => resolve(docId), { once: true });
    });

    if (!id) {
      console.warn("[Custom Patch] ❌ Could not resolve docId.");
      return;
    }

    const perms = await getCurrentUserPermissions(id);

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

    // --- LABELBLOCK-SPECIFIC HIDE LOGIC ---
    applyLabelBlockPatch(perms.canAdd);

    // --- DEV BANNER ---
    showDevBannerIfApplicable();
  }

  // === 10. Trigger main logic on load ===
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', applyVisibilityControls);
  } else {
    applyVisibilityControls();
  }

  // --- Fail-safe: Run after full window load too ---
  window.addEventListener('load', () => {
    console.log("[Custom Patch] ⏳ window.onload fallback triggered");
    applyVisibilityControls();
  });
})();
