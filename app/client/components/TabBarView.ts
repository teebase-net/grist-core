/**
 * TabBarView.ts - Tab Bar Widget for Grist
 * [Truncated description for brevity]
 */
import { ViewRec } from 'app/client/models/DocModel';
// MOD DMH
// Adjusted import paths and removed unused GrainJS
import { computed, DomElementArg } from 'grainjs';
import { css } from 'app/client/components/style'; // Adjusted path
import { BaseView, ViewOptions } from 'app/client/components/BaseView'; // Adjusted path
// end MOD DMH

export class TabBarView extends BaseView {
  // MOD DMH
  // Added viewRec as a private property to store the constructor parameter
  private readonly viewRec: ViewRec;
  constructor(viewRec: ViewRec, options: ViewOptions) {
    super(viewRec, options);
    this.viewRec = viewRec; // Store viewRec for access
    this._initDragDrop();
  }
  // end MOD DMH

  private _initDragDrop() {
    const grid = document.querySelector(`#grid-${this.viewRec.id}`) as HTMLElement;
    if (grid) {
      const widgets = grid.querySelectorAll('.tab-widget');
      widgets.forEach(widget => {
        widget.setAttribute('draggable', 'true');
        // MOD DMH
        // Changed Event to DragEvent for dataTransfer
        widget.addEventListener('dragstart', (e: DragEvent) => {
          e.dataTransfer?.setData('text/plain', widget.id);
        });
        widget.addEventListener('dragover', (e: DragEvent) => {
          e.preventDefault();
          widget.classList.add('drop-target');
        });
        widget.addEventListener('dragleave', (e: DragEvent) => {
          widget.classList.remove('drop-target');
        });
        widget.addEventListener('drop', (e: DragEvent) => {
          e.preventDefault();
          const id = e.dataTransfer?.getData('text');
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
        const subWidgets = this.viewRec.subWidgets.peek() || [];
        // MOD DMH
        // Added type annotation for w
        const draggedIndex = subWidgets.findIndex((w: ViewRec) => `widget-${w.id}` === draggedId);
        const targetIndex = subWidgets.findIndex((w: ViewRec) => `widget-${w.id}` === targetId);
        // end MOD DMH
        if (draggedIndex >= 0 && targetIndex >= 0) {
          const [moved] = subWidgets.splice(draggedIndex, 1);
          subWidgets.splice(isAfter ? targetIndex + 1 : targetIndex, 0, moved);
          this.viewRec.subWidgets(subWidgets);
          this.viewRec.save();
        }
      }
    }
  }

  protected buildDom(): DomElementArg {
    return css.tabContainer(
      css.tabBar(computed((use) => {
        // MOD DMH
        // Typed tabs as ViewRec[] and added type annotations
        const tabs = use(this.viewRec.tabs) as ViewRec[] || [];
        return tabs.map((tab: ViewRec, index: number) => css.tab(
          { onClick: () => this._setActiveTab(index) },
          tab.name || `Tab ${index + 1}`
        ));
        // end MOD DMH
      })),
      css.tabContent(
        computed((use) => css.gridContainer(
          { id: `grid-${this.viewRec.id}` },
          // MOD DMH
          // Typed subWidgets as ViewRec[] and added type annotation
          use(this.viewRec.subWidgets as Observable<ViewRec[]>).map((w: ViewRec) => css.tabWidget(
            { id: `widget-${w.id}`, class: 'tab-widget' },
            w.type
          ))
          // end MOD DMH
        ))
      )
    );
  }

  private _setActiveTab(index: number) {
    this.viewRec.activeTab(index);
  }
}

// MOD DMH
// Moved css outside class to avoid circular reference
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
