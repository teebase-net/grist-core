import { dom, styled, computed } from 'grainjs';
import { ViewSectionRec } from 'app/client/models/DocModel';
import { GristDoc } from 'app/client/components/GristDoc';

const TabBarView = (gristDoc: GristDoc) => {
  const sections = computed(() => gristDoc.viewModel.activeSection.peek() as ViewSectionRec[] || []);

  return dom('div',
    styled.container(
      styled.tabGrid(
        computed(() => sections().map((sec, i) => dom('div',
          styled.tab(
            { 
              style: { gridRow: i + 1 },
              onClick: () => console.log(`Selected tab ${sec.label || i}`),
              draggable: true,
              onDragStart: (e: DragEvent) => e.dataTransfer?.setData('text/plain', String(i)),
              onDragOver: (e: DragEvent) => e.preventDefault(),
              onDrop: (e: DragEvent) => {
                e.preventDefault();
                const fromIndex = Number(e.dataTransfer?.getData('text/plain'));
                const toIndex = i;
                if (fromIndex !== toIndex) reorderTabs(fromIndex, toIndex);
              }
            },
            sec.label || `Tab ${i + 1}`
          )
        )))
      )
    )
  );

  function reorderTabs(fromIndex: number, toIndex: number) {
    const newSections = [...sections()];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, moved);
    // Update logic would go here, e.g., via GristDoc API
    console.log('Reordered tabs:', newSections.map(s => s.label));
  }
};

const styled = {
  container: styled.cls('tab-container', {
    display: 'grid',
    gridTemplateRows: 'auto',
    gap: '5px',
    padding: '10px',
  }),
  tabGrid: styled.cls('tab-grid', {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '2px',
  }),
  tab: styled.cls('tab', {
    padding: '10px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    background: '#f9f9f9',
    '&:hover': { background: '#e0e0e0' },
  }),
} as const;

export default TabBarView;
