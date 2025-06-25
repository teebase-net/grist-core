```typescript
import { BaseView, ViewOptions } from 'app/client/ui/BaseView';
import { GrainJS, computed, DomElementArg } from 'grainjs';
import { css } from 'app/client/ui/style';
import { ViewRec } from 'app/client/models/DocModel';

export class TabBarView extends BaseView {
  constructor(viewRec: ViewRec, options: ViewOptions) {
    super(viewRec, options);
    this._initDragDrop();
  }

  private _initDragDrop() {
    const grid = document.querySelector(`#grid-${this.viewRec.id}`) as HTMLElement;
    if (grid) {
      const widgets = grid.querySelectorAll('.tab-widget');
      widgets.forEach(widget => {
        widget.setAttribute('draggable', 'true');
        widget.addEventListener('dragstart', (e) => {
          e.dataTransfer?.setData('text/plain', widget.id);
        });
        widget.addEventListener('dragover', (e) => {
          e.preventDefault(); // Allow drop
          widget.classList.add('drop-target');
        });
        widget.addEventListener('dragleave', (e) => {
          widget.classList.remove('drop-target');
        });
        widget.addEventListener('drop', (e) => {
          e.preventDefault();
          const id = e.dataTransfer?.getData('text');
          const target = e.target as HTMLElement;
          if (id && target.classList.contains('tab-widget')) {
            this._reorderWidgets(id, target.id);
          }
          widget.classList.remove('drop-target');
        });
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
        // Update subWidgets order in viewRec (simplified)
        const subWidgets = this.viewRec.subWidgets.peek() || [];
        const draggedIndex = subWidgets.findIndex(w => `widget-${w.id}` === draggedId);
        const targetIndex = subWidgets.findIndex(w => `widget-${w.id}` === targetId);
        if (draggedIndex >= 0 && targetIndex >= 0) {
          const [moved] = subWidgets.splice(draggedIndex, 1);
          subWidgets.splice(isAfter ? targetIndex + 1 : targetIndex, 0, moved);
          this.viewRec.subWidgets(subWidgets);
          this.viewRec.save(); // Persist changes
        }
      }
    }
  }

  protected buildDom(): DomElementArg {
    return css.tabContainer(
      css.tabBar(computed((use) => {
        const tabs = use(this.viewRec.tabs) || [];
        return tabs.map((tab, index) => css.tab(
          { onClick: () => this._setActiveTab(index) },
          tab.name || `Tab ${index + 1}`
        ));
      })),
      css.tabContent(
        computed((use) => css.gridContainer(
          { id: `grid-${this.viewRec.id}` },
          use(this.viewRec.subWidgets).map(w => css.tabWidget(
            { id: `widget-${w.id}`, class: 'tab-widget' },
            w.type
          ))
        ))
      )
    );
  }

  private _setActiveTab(index: number) {
    this.viewRec.activeTab(index);
  }
}

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
```
