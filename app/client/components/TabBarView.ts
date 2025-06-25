import { dom, styled, computed } from 'grainjs';
import { ViewSectionRec } from 'app/client/models/DocModel';
import { GristDoc } from 'app/client/components/GristDoc';

const TabBarView = (gristDoc: GristDoc) => {
  const sections = computed(() => {
    const activeSection = gristDoc.viewModel.activeSection.peek() as ViewSectionRec | undefined;
    return activeSection ? [activeSection] : [];
  });

  return dom('div',
    tabContainer(
      tabGrid(
        sections.map((sec, i) => dom('div',
          tab(
            {
              style: `grid-row: ${i + 1};`,
              onClick: () => console.log(`Selected tab ${sec.widgetType || i}`),
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
            sec.widgetType || `Tab ${i + 1}`
          )
        ))
      )
    )
  );

  function reorderTabs(fromIndex: number, toIndex: number) {
    const newSections = [...sections.get()];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, moved);
    console.log('Reordered tabs:', newSections.map(s => s.widgetType || `Tab ${newSections.indexOf(s) + 1}`));
  }
};

const tabContainer = styled('div', `
  display: grid;
  grid-template-rows: auto;
  gap: 5px;
  padding: 10px;
`);

const tabGrid = styled('div', `
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
`);

const tab = styled('div', `
  padding: 10px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: #f9f9f9;
  &:hover {
    background: #e0e0e0;
  }
  &.drop-target {
    border-color: #007bff;
    background: #e9f0fa;
  }
`);

export default TabBarView;
