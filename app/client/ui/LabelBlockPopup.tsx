import React, { useEffect, useRef } from 'react';
import Quill from 'quill';

interface LabelBlockPopupProps {
  heading: string;
  body: string;
  onClose: () => void;
}

export function LabelBlockPopup({ heading, body, onClose }: LabelBlockPopupProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      const quill = new Quill(bodyRef.current, {
        readOnly: true,
        theme: 'bubble',
        modules: { toolbar: false },
      });
      try {
        quill.setContents(JSON.parse(body));
      } catch (e) {
        quill.setText(body);
      }
    }

    const handler = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".labelblock-popup")) {
        onClose();
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [body, onClose]);

  return (
    <div style={overlayStyle}>
      <div className="labelblock-popup" style={popupStyle}>
        <h2 style={headingStyle}>{heading}</h2>
        <div ref={bodyRef} className="ql-container ql-bubble" style={{ height: 'auto' }}>
          <div className="ql-editor" />
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const popupStyle: React.CSSProperties = {
  background: '#fff',
  padding: '24px',
  borderRadius: '8px',
  maxWidth: '700px',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxShadow: '0 0 15px rgba(0,0,0,0.3)',
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 12px 0',
  fontSize: '20px',
  textAlign: 'left',
};
