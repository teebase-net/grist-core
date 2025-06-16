// Location: app/client/ui/LabelBlockPopup.ts
// ~! Pure GrainJS + Grist-style modal popup with Quill rendering

import Quill from 'quill';
import {dom, DomContents, makeTestId} from 'grainjs';

const testId = makeTestId('test-labelblock-popup-');

/**
 * Displays a modal popup for LabelBlock content.
 * @param heading Quill-encoded heading (Delta JSON string).
 * @param body Quill-encoded body (Delta JSON string).
 * @param onClose Callback for when the modal is dismissed.
 */
export function LabelBlockPopup(opts: {heading: string, body: string, onClose: () => void}): DomContents {
  const headingRef = dom('div', testId('heading'), dom.cls('ql-container'), dom.cls('ql-snow'));
  const bodyRef = dom('div', testId('body'), dom.cls('ql-container'), dom.cls('ql-bubble'));

  return dom(
    'div',
    testId('overlay'),
    dom.style({
      position: 'fixed',
      top: '0', left: '0', right: '0', bottom: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: '1000',
    }),
    dom.on('click', opts.onClose),
    dom('div',
      testId('popup'),
      dom.style({
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        cursor: 'auto'
      }),
      dom.on('click', (ev) => ev.stopPropagation()), // Prevent close on inner click
      headingRef,
      bodyRef,
      dom.maybe(() => {
        setTimeout(() => {
          try {
            const headingEditor = new Quill(headingRef as HTMLElement, { readOnly: true, theme: 'snow' });
            headingEditor.setContents(JSON.parse(opts.heading || '{}'));

            const bodyEditor = new Quill(bodyRef as HTMLElement, { readOnly: true, theme: 'bubble' });
            bodyEditor.setContents(JSON.parse(opts.body || '{}'));
          } catch (e) {
            console.error('Failed to load LabelBlock content:', e);
          }
        }, 0);
        return null;
      })
    )
  );
}
