# Feature Manifest: Custom Master Controller

This directive tracks the capabilities of the `static/custom_index.js` (Master Controller).

## Current Features
1. **Version Logging**: console.log on boot.
2. **WebSocket Sniffing**: Captures `docId`.
3. **Theme Enforcement**: Dark mode toggle.
4. **Gridview Alignment**: 30px row-num snap.
5. **Dev Banner**: Pink banner for `- DEV` docs.
6. **Discrete Timer**: Session countdown.
7. **Permission Cloaking**: Hiding UI based on state.
8. **Session Watchdog**: 30m timeout protection.
9. **Action Highlighting**: Red "Delete" buttons.
10. **Footer Alignment Patch**: Frozen column spacing fix.

## Working with `custom_index.js`
- **Location**: `static/custom_index.js`
- **Pattern**: Most features are self-contained IIFEs (Immediately Invoked Function Expressions).
- **Execution**: This file is injected into the client browser.
