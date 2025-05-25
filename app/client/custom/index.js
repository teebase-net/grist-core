/* global window document MutationObserver */
/**
 * index.js
 *
 * Custom patch script injected by Grist app.js
 *
 * 🔧 MOD DMH — May 2025:
 * - Conditionally hides the “+ Add Column” button unless the current user has
 *   `Unlock_Structure = true` in the `SysUsers` table.
 * - Skips gracefully if table or fields are missing.
 *
 * File: /app/client/custom/index.js
 * Version: v0.6 (corrected)
 */

// MOD DMH: Hide “Add Column” button unless user has Unlock_Structure permission
"use strict";


console.log("[Custom Patch] index.js loaded ✅ v0.6");

(function () {
  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];

  async function hasUnlockStructure() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
      const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (!res.ok) {
        console.warn("SysUsers table missing — skipping control logic.");
        return null;
      }

      const data = await res.json();
      if (!data?.id?.length || !data?.Email || !data?.Unlock_Structure) {
        console.warn("Required fields missing — skipping control logic.");
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
      console.warn("Unlock_Structure check failed — skipping control logic.", err);
      return null;
    }
  }

  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();
    if (allowed === null) return; // Skip everything if check not valid

    const toggle = () => {
      document.querySelectorAll('.mod-add-column').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    };

    new MutationObserver(toggle).observe(document.body, { childList: true, subtree: true });
    toggle();

    console.log(`[Custom Patch] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }

  window.addEventListener('load', () => {
    setTimeout(controlAddColumnButtons, 1500);
  });
})();
// end MOD DMH
