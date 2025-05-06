"use strict";

/*===================================================================================
  🔧 Custom Patch: Conditional visibility of “Add Column” button
  📄 File: custom/index.js
  📅 Applied: 2025-05-05
  📝 Purpose:
    Hides the “+” Add Column button unless the logged-in user has `Unlock_Structure = true`
    in the SysUsers table. Used for permission-based structure editing.
    Injected at runtime via a <script> tag in index.ejs or similar.

  ✅ Loaded when Grist finishes loading the UI.
  ✅ Uses DOM observer to catch dynamically rendered buttons.

  Version: v0.3
===================================================================================*/

console.log("[Custom JS] index.js loaded ✅ v0.3");

(function () {
  // Utility: Get the current document ID
  const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];

  // Fetch current user's profile and SysUsers data, then check access
  async function hasUnlockStructure() {
    try {
      const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());

      // Try to fetch SysUsers data — handle 404 gracefully
      const response = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });

      if (response.status === 404) {
        console.warn("🔒 SysUsers table not found — skipping Unlock_Structure check.");
        return false;
      }

      const data = await response.json();
      const rowCount = data?.id?.length;
      if (!rowCount) return false;

      const records = Array.from({ length: rowCount }, (_, i) => {
        const row = {};
        for (const field in data) {
          row[field] = data[field][i];
        }
        return row;
      });

      const user = records.find(
        u => u.Email?.trim().toLowerCase() === profile.email?.trim().toLowerCase()
      );

      return user?.Unlock_Structure === true;
    } catch (err) {
      console.warn("🔒 Unlock check failed:", err);
      return false;
    }
  }

  // Hide or show .mod-add-column buttons based on permission
  async function controlAddColumnButtons() {
    const allowed = await hasUnlockStructure();

    const observer = new MutationObserver(() => {
      document.querySelectorAll('.mod-add-column').forEach(el => {
        el.style.display = allowed ? '' : 'none';
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Run immediately once
    document.querySelectorAll('.mod-add-column').forEach(el => {
      el.style.display = allowed ? '' : 'none';
    });

    console.log(`[Custom JS] Unlock_Structure = ${allowed ? '✅ Allowed' : '🚫 Denied'}`);
  }

  // Wait until Grist is ready
  window.addEventListener('load', () => {
    setTimeout(controlAddColumnButtons, 1500);
  });
})();

/*
   ╔════════════════════════════════════════════════════════════════════════════════╗
   ║                                                                                ║
   ║                  CODE BELOW THIS LINE STILL IN DEVELOPMENT                     ║
   ║                                                                                ║
   ╚════════════════════════════════════════════════════════════════════════════════╝
*/
