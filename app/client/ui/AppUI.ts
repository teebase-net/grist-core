import {buildDocumentBanners, buildHomeBanners} from 'app/client/components/Banners';
import {ViewAsBanner} from 'app/client/components/ViewAsBanner';
import {domAsync} from 'app/client/lib/domAsync';
import {
  loadAccountPage,
  loadActivationPage,
  loadAdminPanel,
  loadAuditLogsPage,
  loadBillingPage,
} from 'app/client/lib/imports';
import {createSessionObs, isBoolean, isNumber} from 'app/client/lib/sessionObs';
import {AppModel, TopAppModel} from 'app/client/models/AppModel';
import {DocPageModelImpl} from 'app/client/models/DocPageModel';
import {HomeModelImpl} from 'app/client/models/HomeModel';
import {App} from 'app/client/ui/App';
import {AppHeader} from 'app/client/ui/AppHeader';
import {createBottomBarDoc} from 'app/client/ui/BottomBar';
import {createDocMenu} from 'app/client/ui/DocMenu';
import {createForbiddenPage, createNotFoundPage, createOtherErrorPage} from 'app/client/ui/errorPages';
import {createHomeLeftPane} from 'app/client/ui/HomeLeftPane';
import {buildSnackbarDom} from 'app/client/ui/NotifyUI';
import {OnboardingPage, shouldShowOnboardingPage} from 'app/client/ui/OnboardingPage';
import {pagePanels} from 'app/client/ui/PagePanels';
import {RightPanel} from 'app/client/ui/RightPanel';
import {createTopBarDoc, createTopBarHome} from 'app/client/ui/TopBar';
import {WelcomePage} from 'app/client/ui/WelcomePage';
import {testId} from 'app/client/ui2018/cssVars';
import {getPageTitleSuffix} from 'app/common/gristUrls';
import {getGristConfig} from 'app/common/urlUtils';
import {Computed, dom, IDisposable, IDisposableOwner, Observable, replaceContent, subscribe} from 'grainjs';

// MOD DMH: Imports for LabelBlock
import { waitForElement } from 'app/client/lib/waitForElement';
// end MOD DMH

export function createAppUI(topAppModel: TopAppModel, appObj: App): IDisposable {
  const content = dom.maybe(topAppModel.appObs, (appModel) => {
    return [
      createMainPage(appModel, appObj),
      buildSnackbarDom(appModel.notifier, appModel),
    ];
  });
  dom.update(document.body, content, {
    style: 'font-family: inherit; font-size: inherit; line-height: inherit;'
  });

// MOD DMH: Add LabelBlock maximize support using standard Grist modal behavior
void waitForElement(document, '.custom-widget').then(() => {
  const widgets = document.querySelectorAll('.custom-widget');
  widgets.forEach(widget => {
    const title = widget.querySelector('.test-viewsection-title')?.textContent?.trim();
    if (!title || !title.toLowerCase().includes('labelblock')) return;

    if ((widget as any)._labelblockBound) return;
    (widget as any)._labelblockBound = true;

    // Show and reposition the maximize button
    const maximizeButton = widget.closest('.viewsection_content')?.querySelector('.test-maximize-section');
    if (maximizeButton instanceof HTMLElement) {
      maximizeButton.style.display = 'block';
      maximizeButton.style.opacity = '1';
      maximizeButton.style.pointerEvents = 'auto';
      maximizeButton.style.position = 'absolute';
      maximizeButton.style.top = '5px';
      maximizeButton.style.right = '5px';
      maximizeButton.style.zIndex = '10';
      maximizeButton.style.background = 'white';
      maximizeButton.style.borderRadius = '4px';
    }

    // Minimize other titlebar elements
    const headerBar = widget.closest('.viewsection_content')?.querySelector('.viewsection_header') as HTMLElement;
    if (headerBar) {
      const titleEl = headerBar.querySelector('.test-viewsection-title') as HTMLElement;
      const gearIcon = headerBar.querySelector('.test-viewsection-gear') as HTMLElement;
      const widgetMenu = headerBar.querySelector('.test-section-menu') as HTMLElement;

      if (titleEl) titleEl.style.display = 'none';
      if (gearIcon) gearIcon.style.display = 'none';
      if (widgetMenu) widgetMenu.style.display = 'none';

      headerBar.style.background = 'transparent';
      headerBar.style.border = 'none';
      headerBar.style.height = '0px';
      headerBar.style.overflow = 'visible';
      headerBar.style.position = 'relative';
    }
  });
});
// end MOD DMH


  function dispose() {
    const [beginMarker, endMarker] = content;
    replaceContent(beginMarker, endMarker, null);
    dom.domDispose(beginMarker);
    dom.domDispose(endMarker);
    document.body.removeChild(beginMarker);
    document.body.removeChild(endMarker);
  }
  return {dispose};
}

function createMainPage(appModel: AppModel, appObj: App) {
  if (!appModel.currentOrg && appModel.needsOrg.get()) {
    const err = appModel.orgError;
    if (err && err.status === 404) {
      return createNotFoundPage(appModel);
    } else if (err && (err.status === 401 || err.status === 403)) {
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
  (window as any).gristDocPageModel = pageModel;
  appObj.pageModel = pageModel;
  const leftPanelOpen = createSessionObs<boolean>(owner, "leftPanelOpen", true, isBoolean);
  const rightPanelOpen = createSessionObs<boolean>(owner, "rightPanelOpen", false, isBoolean);
  const leftPanelWidth = createSessionObs<number>(owner, "leftPanelWidth", 240, isNumber);
  const rightPanelWidth = createSessionObs<number>(owner, "rightPanelWidth", 240, isNumber);

  const rightPanel = Computed.create(owner, pageModel.gristDoc, (use, gristDoc) =>
    gristDoc ? RightPanel.create(use.owner, gristDoc, rightPanelOpen) : null);

  owner.autoDispose(subscribe(pageModel.currentDocTitle, (use, docName) => {
    if (!pageModel.currentDoc.get()) { return; }
    document.title = `${docName}${getPageTitleSuffix(getGristConfig())}`;
  }));

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
