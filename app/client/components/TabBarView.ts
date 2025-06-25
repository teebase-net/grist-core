/**
 * TabBarView.ts - Tab Bar Widget for Grist
 * [Truncated description for brevity]
 */
import { ViewSectionRec } from 'app/client/models/DocModel';
// MOD DMH
// Adjusted import paths and handled BaseView correctly
import { computed, DomElementArg, Disposable, Observable } from 'grainjs';
import { css } from 'app/client/ui/style'; // Corrected path
import BaseView = require('app/client/components/BaseView'); // Require-style import
// end MOD DMH

export class TabBarView extends BaseView implements Disposable, ViewConfigTab {
  // MOD DMH
  // Updated to use ViewSectionRec and added Disposable implementation
  private readonly viewRec: ViewSectionRec;
  constructor(viewRec: ViewSectionRec, options: any) { // Adjust options type if defined
    super(viewRec, options);
    this.viewRec = viewRec;
    this._initDragDrop();
  }

  dispose(): void {
    // Implement dispose if needed, currently empty as no resources to clean up
  }

  // Stub implementations for ViewConfigTab (to be fully implemented based on interface)
  buildSortFilterDom(): DomElementArg { return null; }
  _buildAdvancedSettingsDom(): DomElementArg { return null; }
  _buildThemeDom(): DomElementArg { return null; }
  _buildChartConfigDom(): DomElementArg { return null; }
  // Add other required methods from ViewConfigTab as needed
  // end MOD DMH

  private _initDragDrop() {
    const grid = document.querySelector(`#grid-${this.viewRec.id}`) as HTMLElement;
    if (grid) {
      const widgets = grid.querySelectorAll('.tab-widget');
      widgets.forEach(widget => {
        widget.setAttribute('draggable', 'true');
        // MOD DMH
        // Used string overload with DragEvent casting
        widget.addEventListener('dragstart', (e: Event) => {
          const dragEvent = e as DragEvent;
          dragEvent.dataTransfer?.setData('text/plain', widget.id);
        });
        widget.addEventListener('dragover', (e: Event) => {
          const dragEvent = e as DragEvent;
          dragEvent.preventDefault();
          widget.classList.add('drop-target');
        });
        widget.addEventListener('dragleave', (e: Event) => {
          const dragEvent = e as DragEvent;
          widget.classList.remove('drop-target');
        });
        widget.addEventListener('drop', (e: Event) => {
          const dragEvent = e as DragEvent;
          dragEvent.preventDefault();
          const id = dragEvent.dataTransfer?.getData('text');
          const target = e.target as HTMLElement;
          if (id && target.classList.contains('tab-widget')) {
            this._reorderWidgets(id, target.id);
          }
          widget.classList.remove('drop-target');
        });
        // end MOD DMH
      });
    }
  }

  private _reorderWidgets(draggedId: string, targetId: string) {
    const grid = document.querySelector(`#grid-${this.viewRec.id}`) as HTMLElement;
    if (grid) {
      const dragged = grid.querySelector(`#${draggedId}`) as HTMLElement;
      const target = grid.querySelector(`#${targetId}`) as HTMLElement;
      if (dragged && target && dragged !== target) {
        const isAfter = Array.from(grid.children).indexOf(target) > Array.from(grid.children).indexOf(dragged);
        grid.insertBefore(dragged, isAfter ? target.nextSibling : target);
        // MOD DMH
        // Adjusted to use existing ViewSectionRec properties or assume custom ones
        const subWidgets = this.viewRec.widgetOptions?.peek()?.subWidgets || []; // Adjust based on actual structure
        const draggedIndex = subWidgets.findIndex((w: ViewSectionRec) => `widget-${w.id}` === draggedId);
        const targetIndex = subWidgets.findIndex((w: ViewSectionRec) => `widget-${w.id}` === targetId);
        // end MOD DMH
        if (draggedIndex >= 0 && targetIndex >= 0) {
          const [moved] = subWidgets.splice(draggedIndex, 1);
          subWidgets.splice(isAfter ? targetIndex + 1 : targetIndex, 0, moved);
          // MOD DMH
          // Adjusted to use a method or property that exists
          this.viewRec.setWidgetOptions({ subWidgets }); // Placeholder, adjust based on API
          // end MOD DMH
        }
      }
    }
  }

  protected buildDom(): DomElementArg {
    return css.tabContainer(
      css.tabBar(computed((use) => {
        // MOD DMH
        // Adjusted to use existing tabs or a default
        const tabs = use(this.viewRec.widgetOptions?.tabs) as ViewSectionRec[] || [];
        return tabs.map((tab: ViewSectionRec, index: number) => css.tab(
          { onClick: () => this._setActiveTab(index) },
          tab.name || `Tab ${index + 1}`
        ));
        // end DMH
      })),
      css.tabContent(
        computed((use) => css.gridContainer(
          { id: `grid-${this.viewRec.id}` },
          // MOD DMH
          // Adjusted to use existing subWidgets
          use(this.viewRec.widgetOptions?.subWidgets as Observable<ViewSectionRec[]>).map((w: ViewSectionRec) => css.tabWidget(
            { id: `widget-${w.id}`, class: 'tab-widget' },
            w.type
          ))
          // end MOD DMH
        ))
      )
    );
  }

  private _setActiveTab(index: number) {
    // MOD DMH
    // Adjusted to use an existing method or property
    this.viewRec.setActiveTab(index); // Placeholder, adjust based on API
    // end MOD DMH
  }
}

// MOD DMH
// Moved css outside with proper typing
const css = {
  tabContainer: css.cls('tab-container', {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }),
  tabBar: css.cls('tab-bar', {
    display: 'flex',
    borderBottom: '1px solid #ccc',
  }),
  tab: css.cls('tab', {
    padding: '5px 10px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderBottom: 'none',
    marginRight: '5px',
  }),
  tabContent: css.cls('tab-content', {
    flexGrow: 1,
    padding: '10px',
  }),
  gridContainer: css.cls('grid-container', {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  }),
  tabWidget: css.cls('tab-widget', {
    border: '1px dashed #ccc',
    padding: '10px',
    minWidth: '200px',
    background: '#f9f9f9',
  }),
  'drop-target': css.cls('drop-target', {
    borderColor: '#007bff',
    background: '#e9f0fa',
  }),
};
// end MOD DMH
