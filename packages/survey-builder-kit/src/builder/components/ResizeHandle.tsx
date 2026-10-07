import { useRef, useState } from 'react';
import { Box } from '@mui/material';

const KEY_STEP = 16;

export interface ResizeHandleProps {
  // Which edge of the panel this handle sits on -- the sidebar's handle is
  // on its RIGHT edge (dragging right grows it), the right panel's handle is
  // on its LEFT edge (dragging left grows it, since it's anchored to the
  // right side of the layout).
  edge: 'left' | 'right';
  width: number;
  min: number;
  max: number;
  defaultWidth: number;
  onChange: (width: number) => void;
  label: string;
}

// A single resizable-panel primitive shared by the left Pages sidebar and
// the right Branching/Scoring/Flow-map panel -- both use this exact
// component (see PageSidebar.tsx and Inspector.tsx/FlowOverviewPanel.tsx/
// FlowMapPagePanel.tsx) rather than two parallel resize implementations.
//
// Pointer capture (not window-level mousemove listeners) keeps this
// self-contained: once captured, move/up events keep targeting this element
// even if the cursor leaves it, and stopPropagation on pointerdown keeps the
// gesture from ever reaching an ancestor dnd-kit sortable row or a React
// Flow node/edge underneath -- a drag that starts here can never be
// mistaken for one of those.
export function ResizeHandle({ edge, width, min, max, defaultWidth, onChange, label }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Deliberately NOT preventDefault() here: doing so on pointerdown
    // suppresses the browser's compatibility click/dblclick events for the
    // rest of the gesture, which would silently break double-click-to-reset.
    // Text-selection during the drag is prevented via user-select below
    // instead.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { pointerId: e.pointerId, startX: e.clientX, startWidth: width };
    setDragging(true);
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || dragStart.current.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - dragStart.current.startX;
    const delta = edge === 'left' ? -dx : dx;
    onChange(clamp(dragStart.current.startWidth + delta));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || dragStart.current.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragStart.current = null;
    setDragging(false);
    document.body.style.userSelect = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const growKey = edge === 'left' ? 'ArrowLeft' : 'ArrowRight';
    const shrinkKey = edge === 'left' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === growKey) {
      onChange(clamp(width + KEY_STEP));
      e.preventDefault();
    } else if (e.key === shrinkKey) {
      onChange(clamp(width - KEY_STEP));
      e.preventDefault();
    } else if (e.key === 'Home') {
      onChange(min);
      e.preventDefault();
    } else if (e.key === 'End') {
      onChange(max);
      e.preventDefault();
    }
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onChange(defaultWidth)}
      onKeyDown={handleKeyDown}
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [edge]: -3,
        width: 6,
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 2,
        bgcolor: dragging ? 'primary.main' : 'transparent',
        opacity: dragging ? 0.5 : 1,
        transition: dragging ? 'none' : 'background-color 0.1s',
        '&:hover': { bgcolor: 'primary.main', opacity: 0.35 },
        '&:focus-visible': { bgcolor: 'primary.main', opacity: 0.5, outline: 'none' },
      }}
    />
  );
}
