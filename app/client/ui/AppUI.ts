/**
 * AppUI.ts
 *
 * 🏦 Patch: Replace Toast Notifications with Modal Alerts
 * 📜 File: /app/client/ui/AppUI.ts
 * 🴵️ Applied: June 2025
 * 👤 Author: DMH
 *
 * Summary:
 * - Overrides default Grist toast system (NotifyUI) with a modal-style notification.
 * - Modal appears centered, matches desktop theme, includes a dismiss button.
 * - Only the notification rendering is affected. No upstream Grist logic is changed.
 */

import {AppModel, TopAppModel} from 'app/client/models/AppModel';
import {App} from 'app/client/ui/App';
import {Computed, dom, IDisposable, IDisposableOwner, Observable, styled} from 'grainjs';

/**
 * MOD DMH - createAppUI override
 * Replaces default Grist toast notifications with custom modal handler
 */
export function createAppUI(topAppModel: TopAppModel, appObj: App): IDisposable {
  const modalContainer = cssModalContainer();
  document.body.appendChild(modalContainer);

  const content = dom.maybe(topAppModel.appObs, (appModel) => {
    return [
      createMainPage(appModel, appObj), // existing main layout
      buildModalDom(topAppModel.notifier), // MOD DMH - modal notifications
    ];
  });

  dom.update(document.body, content, {
    style: 'font-family: inherit; font-size: inherit; line-height: inherit;',
  });

  function dispose() {
    const [beginMarker, endMarker] = content;
    dom.domDispose(beginMarker);
    dom.domDispose(endMarker);
    document.body.removeChild(beginMarker);
    document.body.removeChild(endMarker);
    modalContainer.remove(); // clean up modal
  }
  return {dispose};
}

// MOD DMH - build modal popup bound to notifier
function buildModalDom(notifier: any) {
  const visible = Observable.create(null, false);
  const message = Observable.create(null, '');
  const type = Observable.create(null, 'info');

  notifier.addHandler((note: any) => {
    message.set(note.text || '');
    type.set(note.type || 'info');
    visible.set(true);
  });

  return dom.maybe(visible, () =>
    cssModal(
      dom.cls('error', () => type.get() === 'error'),
      dom.cls('info', () => type.get() === 'info'),
      dom('div',
        dom('p', message.get()),
        dom('button', 'OK', dom.on('click', () => visible.set(false)))
      )
    )
  );
}

// MOD DMH - container div to center modal
const cssModalContainer = () =>
  dom('div',
    dom.style('position', 'fixed'),
    dom.style('top', '0'),
    dom.style('left', '0'),
    dom.style('width', '100%'),
    dom.style('height', '100%'),
    dom.style('zIndex', '9999'),
    dom.style('pointerEvents', 'none'),
    dom.style('display', 'flex'),
    dom.style('alignItems', 'center'),
    dom.style('justifyContent', 'center'),
    dom.style('padding', '20px')
  );

// MOD DMH - modal style block
const cssModal = styled('div', `
  background: black;
  color: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 0 15px rgba(0,0,0,0.5);
  pointer-events: auto;
  z-index: 10000;
  font-size: 16px;
  max-width: 90vw;
  text-align: center;

  &.error { border: 2px solid red; }
  &.info { border: 2px solid #007bff; }

  & button {
    margin-top: 16px;
    padding: 6px 12px;
    font-size: 14px;
    cursor: pointer;
    background: #fff;
    color: #000;
    border: none;
    border-radius: 4px;
  }
`);



// ------- Below here is unchanged  -------------------------------------------------

function createMainPage(appModel: AppModel, appObj: App) {
  if (!appModel.currentOrg && appModel.needsOrg.get()) {
    const err = appModel.orgError;
    if (err && err.status === 404) {
      return createNotFoundPage(appModel);
    } else if (err && (err.status === 401 || err.status === 403)) {
      // Generally give access denied error.
      // The exception is for document pages, where we want to allow access to documents
      // shared publicly without being shared specifically with the current user.
      if (appModel.pageType.get() !== 'doc') {
        return createForbiddenPage(appModel);
      }
    } else {
      return createOtherErrorPage(appModel, err && err.error);
    }
  }
  return dom.domComputed(appModel.pageType, (pageType) => {
    if (pageType === 'home') {
      return dom.create(pagePanelsHome, appModel, appObj);
    } else if (pageType === 'billing') {
      return domAsync(loadBillingPage().then(bp => dom.create(bp.BillingPage, appModel)));
    } else if (pageType === 'welcome') {
      return dom.create(WelcomePage, appModel);
    } else if (pageType === 'account') {
      return domAsync(loadAccountPage().then(ap => dom.create(ap.AccountPage, appModel)));
    } else if (pageType === 'admin') {
      return domAsync(loadAdminPanel().then(m => dom.create(m.AdminPanel, appModel)));
    } else if (pageType === 'activation') {
      return domAsync(loadActivationPage().then(ap => dom.create(ap.getActivationPage(), appModel)));
    } else if (pageType === 'audit-logs') {
      return domAsync(loadAuditLogsPage().then(m => dom.create(m.AuditLogsPage, appModel)));
    } else {
      return dom.create(pagePanelsDoc, appModel, appObj);
    }
  });
}

function pagePanelsHome(owner: IDisposableOwner, appModel: AppModel, app: App) {
  if (shouldShowOnboardingPage(appModel.userPrefsObs)) {
    return dom.create(OnboardingPage, appModel);
  }

  const pageModel = HomeModelImpl.create(owner, appModel, app.clientScope);
  const leftPanelOpen = Observable.create(owner, true);

  // Set document title to strings like "Home - Grist" or "Org Name - Grist".
  owner.autoDispose(subscribe(pageModel.currentPage, pageModel.currentWS, (use, page, ws) => {
    const name = (
      page === 'trash' ? 'Trash' :
      page === 'templates' ? 'Examples & Templates' :
      ws ? ws.name : appModel.currentOrgName
    );
    document.title = `${name}${getPageTitleSuffix(getGristConfig())}`;
  }));

  return pagePanels({
    leftPanel: {
      panelWidth: Observable.create(owner, 240),
      panelOpen: leftPanelOpen,
      hideOpener: true,
      header: dom.create(AppHeader, appModel),
      content: createHomeLeftPane(leftPanelOpen, pageModel),
    },
    headerMain: createTopBarHome(appModel),
    contentMain: createDocMenu(pageModel),
    contentTop: buildHomeBanners(appModel),
    testId,
  });
}

function pagePanelsDoc(owner: IDisposableOwner, appModel: AppModel, appObj: App) {
  const pageModel = DocPageModelImpl.create(owner, appObj, appModel);
  // To simplify manual inspection in the common case, keep the most recently created
  // DocPageModel available as a global variable.
  (window as any).gristDocPageModel = pageModel;
  appObj.pageModel = pageModel;
  const leftPanelOpen = createSessionObs<boolean>(owner, "leftPanelOpen", true, isBoolean);
  const rightPanelOpen = createSessionObs<boolean>(owner, "rightPanelOpen", false, isBoolean);
  const leftPanelWidth = createSessionObs<number>(owner, "leftPanelWidth", 240, isNumber);
  const rightPanelWidth = createSessionObs<number>(owner, "rightPanelWidth", 240, isNumber);

  // The RightPanel component gets created only when an instance of GristDoc is set in pageModel.
  // use.owner is a feature of grainjs to make the new RightPanel owned by the computed itself:
  // each time the gristDoc observable changes (and triggers the callback), the previously-created
  // instance of RightPanel will get disposed.
  const rightPanel = Computed.create(owner, pageModel.gristDoc, (use, gristDoc) =>
    gristDoc ? RightPanel.create(use.owner, gristDoc, rightPanelOpen) : null);

  // Set document title to strings like "DocName - Grist"
  owner.autoDispose(subscribe(pageModel.currentDocTitle, (use, docName) => {
    // If the document hasn't loaded yet, don't update the title; since the HTML document already has
    // a title element with the document's name, there's no need for further action.
    if (!pageModel.currentDoc.get()) { return; }

    document.title = `${docName}${getPageTitleSuffix(getGristConfig())}`;
  }));

  // Called after either panel is closed, opened, or resized.
  function onResize() {
    const gristDoc = pageModel.gristDoc.get();
    if (gristDoc) { gristDoc.resizeEmitter.emit(); }
  }

  return pagePanels({
    leftPanel: {
      panelWidth: leftPanelWidth,
      panelOpen: leftPanelOpen,
      header: dom.create(AppHeader, appModel, pageModel),
      content: pageModel.createLeftPane(leftPanelOpen),
    },
    rightPanel: {
      panelWidth: rightPanelWidth,
      panelOpen: rightPanelOpen,
      header: dom.maybe(rightPanel, (panel) => panel.header),
      content: dom.maybe(rightPanel, (panel) => panel.content),
    },
    headerMain: dom.create(createTopBarDoc, appModel, pageModel, appObj.allCommands),
    contentMain: dom.maybe(pageModel.gristDoc, (gristDoc) => gristDoc.buildDom()),
    onResize,
    testId,
    contentTop: buildDocumentBanners(pageModel),
    contentBottom: dom.create(createBottomBarDoc, pageModel, leftPanelOpen, rightPanelOpen),
    banner: dom.create(ViewAsBanner, pageModel),
  });
}
