/* global window document MutationObserver */
/**
 * index.js
 *
 * Custom patch script injected by Grist app.js
 *
 * 🔧 MOD DMH — May 2025:
 * - 1. Conditionally hides the “+ Add Column” button unless the current user has
 *   `Unlock_Structure = true` in the `SysUsers` table.
 * - 2. Conditionally hides the Share icon unless the current user has
 *   `Export_Data = true` in the `SysUsers` table.
  * - 3. Conditionally hides the Download links via the elipse icon unless the current user has
 *   `Export_Data = true` in the `SysUsers` table.
 * - Skips gracefully if table or fields are missing.
 *
 * File: /app/client/custom/index.js
 * Version: v0.7
 */

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v0.8");

(function () {
  function extractDocId() {
    if (window.gristDoc?.docId) return window.gristDoc.docId;

    const parts = window.location.pathname.split('/');
    const docIndex = parts.indexOf('p');
    if (docIndex > -1 && parts.length > docIndex + 1) {
      return parts[docIndex + 1];  // GRIST_ORG_IN_PATH=true
    }
    return parts[1];  // fallback
  }

  const docId = extractDocId();


  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Control “Add Column” button based on Unlock_Structure field         │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  async function hasUnlockStructure() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn("SysUsers table missing — skipping structure control.");
        return null;
      }

      const data = await res.json();
      if (!data?.id?.length || !data?.Email || !data?.Unlock_Structure) {
        console.warn("Required fields missing — skipping structure control.");
        return null;
      }

      const user = Array.from({ length: data.id.length }, (_, i) => ({
        Email: data.Email[i],
        Unlock_Structure: data.Unlock_Structure[i]
      })).find(u =>
        u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
      );

      return user?.Unlock_Structure === true;
    } catch (err) {
      console.warn("Unlock_Structure check failed — skipping structure control.", err);
      return null;
    }
  }

  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();
    if (allowed === null) return;

    const toggle = () => {
      document.querySelectorAll('.mod-add-column').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    };

    new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
    toggle();

    console.log(`[Custom Patch] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }

  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Control Share Icon visibility based on Export_Data field            │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  async function hasExportDataPermission() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn("SysUsers table missing — skipping export control.");
        return null;
      }

      const data = await res.json();
      if (!data?.id?.length || !data?.Email || !data?.Export_Data) {
        console.warn("Required fields missing — skipping export control.");
        return null;
      }

      const user = Array.from({ length: data.id.length }, (_, i) => ({
        Email: data.Email[i],
        Export_Data: data.Export_Data[i]
      })).find(u =>
        u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
      );

      return user?.Export_Data === true;
    } catch (err) {
      console.warn("Export_Data check failed — skipping share icon control.", err);
      return null;
    }
  }

async function controlShareIcon() {
  const allowed = await hasExportDataPermission();
  if (allowed === null) return;

  const toggle = () => {
    document.querySelectorAll('.test-tb-share').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });
  };

  new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
  toggle();

  console.log(`[Custom Patch] Share icon = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
}



  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Control download links based on Export_Data field                   │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  async function controlExportButtons() {
    const allowed = await hasExportDataPermission();
    if (allowed === null) return;

    const toggle = () => {
      document.querySelectorAll('.test-download-section').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    };

    new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
    toggle();

    console.log(`[Custom Patch] Export_Data for download links = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }


  /**
   * ┌─────────────────────────────────────────────────────────────────────┐
   * │ Load handlers after Grist page has rendered                         │
   * └─────────────────────────────────────────────────────────────────────┘
   */
  window.addEventListener('load', () => {
    controlAddColumnButtons();
    controlShareIcon();
    controlExportButtons();

    // Retry logic for icons that may render late
    //const retryUntil = (fn, selector, maxRetries = 20, delay = 1000) => {
    //  let tries = 0;
    //  const check = async () => {
    //    const el = document.querySelector(selector);
    //    console.log(`[Custom Patch] Attempt ${tries + 1}/${maxRetries} — ${selector} ${el ? '✅ Found' : '❌ Not found'}`);
    //    if (el || tries >= maxRetries) {
    //      fn();
    //    } else {
    //      tries++;
    //      setTimeout(check, delay);
    //    }
    //  };
    //  check();
    //};

    //retryUntil(controlShareIcon, '.tour-share-icon');
    //retryUntil(controlExportButtons, '.test-download-section');
  });

  })();
