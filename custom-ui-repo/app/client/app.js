/* global $, window */

/*
===============================================================================
📄 app/client/app.js

Entry point for loading the Grist frontend application.

🔧 MOD DMH — May 2025:
- Adds support for custom UI overrides via `require('./custom')` at end of file.
- Purpose: Load runtime UI patches from `app/client/custom/index.js`.

===============================================================================
*/

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

// ==========================
// MOD DMH: Load custom patch
require('./custom');
console.log("[Custom Patch] ✅ app.js loaded");
// end MOD DMH
