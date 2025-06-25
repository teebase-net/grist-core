/**
 * TabBarView.ts - Tab Bar Widget for Grist
 * [Truncated description for brevity]
 */
import { ViewSectionRec } from 'app/client/models/DocModel';
import { GristDoc } from 'app/client/components/GristDoc'; // For constructor
// MOD DMH
// Adjusted imports: corrected style path, imported ViewConfigTab, and Disposable
import { computed, DomElementArg, Disposable } from 'grainjs';
import { css } from 'app/client/ui2018/cssVars'; // Adjusted to a likely valid path
import ViewConfigTab from 'app/client/components/ViewConfigTab';
// end MOD DMH

export class TabBarView extends BaseView implements ViewConfigTab {
  // MOD DMH
  // Extended Disposable and used GristDoc, stored ViewSectionRec
  private readonly viewRec: ViewSectionRec;
  constructor(gristDoc: GristDoc, options: any) {
    super(gristDoc, options); // Align with BaseView signature
    this.viewRec = gristDoc.viewModel.activeSection.peek() as ViewSectionRec;
    this._initDragDrop();
  }

  // Inherit Disposable methods
  protected _disposalList: Disposable[] = [];
  public onDispose(callback: () => void): this { return Disposable.prototype.onDispose.call(this, callback); }
  public wipeOnDispose(obj: any): this { return Disposable.prototype.wipeOnDispose.call(this, obj); }
  public _wipeOutObject(obj: any): void { Disposable.prototype._wipeOutObject.call(this, obj); }

  // Implement ViewConfigTab methods (stubbed)
  buildSortFilterDom(): DomElementArg { return dom('div'); }
  _buildLayoutDom(): DomElementArg { return dom('div'); }
  _buildCustomTypeItems(): DomElementArg { return dom('div'); }
  _buildAdvancedSettingsDom(): DomElementArg { return dom('div'); }
  _buildThemeDom(): DomElementArg { return dom('div'); }
  _buildChartConfigDom(): DomElementArg { return dom('div'); }
  // Add other methods as per ViewConfigTab interface
  // end MOD DMH

  private _initDragDrop() {
    const grid = document.querySelector(`#grid-${this.viewRec.id}`) as HTMLElement;
    if (grid) {
      const widgets = grid.querySelectorAll('.tab-widget');
      widgets.forEach(widget => {
        widget.setAttribute('draggable', 'true');
        // MOD DMH
        // Removed unused dragEvent, used direct casting
        widget.addEventListener('dragstart', (e: Event) => {
          (e as DragEvent).dataTransfer?.setData('text/plain', widget.id);
        });
        widget.addEventListener('dragover', (e: Event) => {
          (e as DragEvent).preventDefault();
          widget.classList.add('drop-target');
        });
        widget.addEventListener('dragleave', (e: Event) => {
          widget.classList.remove('drop-target');
        });
        widget.addEventListener('drop', (e: Event) => {
          (e as DragEvent).preventDefault();
          const id = (e as DragEvent).dataTransfer?.getData('text');
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
        // Used existing widgetType and label
        const subWidgets = this.viewRec.viewSections.peek() || []; // Adjust based on actual sub-sections
        const draggedIndex = subWidgets.findIndex((w: ViewSectionRec) => `widget-${w.id}` === draggedId);
        const targetIndex = subWidgets.findIndex((w: ViewSectionRec) => `widget-${w.id}` === targetId);
        // end MOD DMH
        if (draggedIndex >= 0 && targetIndex >= 0) {
          const [moved] = subWidgets.splice(draggedIndex, 1);
          subWidgets.splice(isAfter ? targetIndex + 1 : targetIndex, 0, moved);
          // MOD DMH
          // Adjusted to use viewSections setter if available
          this.viewRec.viewSections(subWidgets); // Adjust based on API
          // end MOD DMH
        }
      }
    }
  }

  protected buildDom(): DomElementArg {
    return css.tabContainer(
      css.tabBar(computed((use) => {
        // MOD DMH
        // Used viewSections as tabs
        const tabs = use(this.viewRec.viewSections) as ViewSectionRec[] || [];
        return tabs.map((tab: ViewSectionRec, index: number) => css.tab(
          { onClick: () => this._setActiveTab(index) },
          tab.label || `Tab ${index + 1}` // Used label instead of name
        ));
        // end MOD DMH
      })),
      css.tabContent(
        computed((use) => css.gridContainer(
          { id: `grid-${this.viewRec.id}` },
          use(this.viewRec.viewSections).map((w: ViewSectionRec) => css.tabWidget(
            { id: `widget-${w.id}`, class: 'tab-widget' },
            w.widgetType // Used widgetType instead of type
          ))
        ))
      )
    );
  }

  private _setActiveTab(index: number) {
    // MOD DMH
    // Adjusted to use activeSectionId if available
    this.viewRec.activeSectionId(index); // Adjust based on API
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
} as const;
// end MOD DMH
