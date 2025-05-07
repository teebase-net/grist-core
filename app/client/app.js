/* global $, window */

// This is the entry point into loading the whole of Grist frontend application. Some extensions
// attempt to load it more than once (e.g. "Lingvanex"). This leads to duplicated work and errors.
// At least some of such interference can be neutralized by simply ignoring repeated loads.
if (window._gristAppLoaded) {
  return;
}
window._gristAppLoaded = true;

const {setupLocale} = require('./lib/localization');

const {AppImpl} = require('./ui/App');

// Disable longStackTraces, which seem to be enabled in the browser by default.
var bluebird = require('bluebird');
bluebird.config({ longStackTraces: false });

// Set up integration between grainjs and knockout disposal.
const {setupKoDisposal} = require('grainjs');
const ko = require('knockout');
setupKoDisposal(ko);

$(function() {
  // Manually disable the bfcache. We dispose some components in App.ts on unload, and
  // leaving the cache on causes problems when the browser back/forward buttons are pressed.
  // Some browsers automatically disable it when the 'beforeunload' or 'unload' events
  // have listeners, but not all do (Safari).
  window.onpageshow = function(event) {
    if (event.persisted) { window.location.reload(); }
  };

  const localeSetup = setupLocale();
  // By the time dom ready is fired, resource files should already be loaded, but
  // if that is not the case, we will redirect to an error page by throwing an error.
  localeSetup.then(() => {
    window.gristApp = AppImpl.create(null);
  }).catch(error => {
    throw new Error(`Failed to load locale: ${error?.message || 'Unknown error'}`);
  })
  // Set from the login tests to stub and un-stub functions during execution.
  window.loginTestSandbox = null;

  // These modules are exposed for the sake of browser tests.
  window.exposeModulesForTests = function() {
    return (import('./exposeModulesForTests' /* webpackChunkName: "modulesForTests" */));
  };
  window.exposedModules = {};
  // Make it easy for tests to use loadScript() whether or not exposedModules has already loaded.
  window.loadScript = (name) =>
    window.exposeModulesForTests().then(() => window.exposedModules.loadScript.loadScript(name));
});

/*
===============================================================================
[Custom Patch] Load custom UI enhancements
-------------------------------------------------------------------------------
📄 File: app/client/app.js
🔧 Added: May 2025, custom-iu branch
👤 Author: You

Purpose:
This line loads custom JavaScript logic after the Grist application has fully
initialized. It allows custom UI behaviors (e.g., hiding buttons, modifying access)
to be added without modifying core app logic.

It imports: `app/client/custom/index.js`, which serves as the entry point
for all custom scripts under `app/client/custom/`.

Note:
- This must be the final line of app.js.
- Safe to include as long as `custom/index.js` exists.

===============================================================================
*/
require('./custom');
console.log("[Custom Patch] ✅ app.js loaded");
