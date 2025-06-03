/* eslint-env browser */
/*===================================================================================
  Custom Patch: Conditional UI control based on `Export_Data` permission in SysUsers
  File: custom/index.js
  Applied: 2025-06
  Purpose:
    Blocks Share, Export, and Copy in GridView unless the user has `Export_Data = true`
    - Triggers logic *on user interaction*, bypassing early `docId` timing issues
    - Displays in-app alert if access is denied

  Version: v1.2
===================================================================================*/

"use strict";

console.log("[Custom Patch] index.js loaded ✅ v1.2");

// 🌐 Native Grist-style alert popup (lower-right corner)
function showCustomAlert(msg, type = 'error') {
  const event = new CustomEvent('uiShowToast', {
    detail: {
      text: msg,
      type,
      timeout: 5000,
    }
  });
  window.dispatchEvent(event);
}

// 🔐 Check permission from SysUsers table
async function hasExportPermission() {
  try {
    const docId = window.gristDoc?.docId || window.location.pathname.split('/')[1];
    if (!docId) return false;

    const profile = await fetch('/api/profile/user', { credentials: 'include' }).then(r => r.json());
    const userEmail = profile?.email;
    if (!userEmail) return false;

    const res = await fetch(`/api/docs/${docId}/tables/SysUsers/data`, { credentials: 'include' });
    const data = await res.json();

    const colIds = data.colIds;
    const emailIndex = colIds.indexOf("Email");
    const exportIndex = colIds.indexOf("Export_Data");

    if (emailIndex === -1 || exportIndex === -1) return false;

    for (const row of data.records) {
      if (row[emailIndex] === userEmail) {
        return !!row[exportIndex];
      }
    }
  } catch (err) {
    console.warn("[Custom Patch] Permission check failed:", err);
  }
  return false;
}

// 🚫 Prevent disallowed actions
async function interceptAction(event, label) {
  const isGrid = document.querySelector(".gridview_main") !== null;
  if (!isGrid) return;  // Only apply in GridView

  const allowed = await hasExportPermission();
  if (!allowed) {
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.target) event.target.style.display = "none";
    showCustomAlert(`🚫 You don't have permission to ${label}.`, 'error');
  }
}

// 🎯 Target interactions
document.addEventListener("click", (event) => {
  const shareBtn = event.target.closest('[data-test-id="menu-button-share"]');
  const exportBtn = event.target.closest('[data-test-id="menu-item-export"]');
  if (shareBtn) interceptAction(event, "share this document");
  if (exportBtn) interceptAction(event, "export data");
}, true);

// 🖱️ Block right-click copy in GridView
document.addEventListener("contextmenu", (event) => {
  const isGrid = document.querySelector(".gridview_main") !== null;
  if (!isGrid) return;
  const selection = window.getSelection()?.toString();
  if (selection) {
    interceptAction(event, "copy");
  }
}, true);

// ⌨️ Block keyboard copy (Ctrl/Cmd+C)
document.addEventListener("keydown", (event) => {
  const isGrid = document.querySelector(".gridview_main") !== null;
  if (!isGrid) return;

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  if ((isMac && event.metaKey && event.key === "c") ||
      (!isMac && event.ctrlKey && event.key === "c")) {
    interceptAction(event, "copy");
  }
}, true);
