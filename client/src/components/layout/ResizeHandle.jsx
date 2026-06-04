import { PanelResizeHandle } from 'react-resizable-panels';

const ResizeHandle = ({ id }) => (
  <PanelResizeHandle id={id} className="resize-handle">
    <div className="resize-handle-indicator" />
  </PanelResizeHandle>
);

export default ResizeHandle;
