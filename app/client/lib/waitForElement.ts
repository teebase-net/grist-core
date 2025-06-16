// MOD DMH: waitForElement utility used to detect when LabelBlock widgets appear
export function waitForElement(root: Document | Element, selector: string): Promise<Element> {
  return new Promise(resolve => {
    const el = root.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  });
}
// end MOD DMH
