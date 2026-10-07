import { memo, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Box, Chip, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import type { FlowPageNodeData } from '../../../domain/flowLayout';
import { resolvePageIcon } from '../../pageIcon';
import { useBuilderStore } from '../../store/builderStore';

// Extra, UI-only fields layered onto the domain layout data by FlowMapView --
// deliberately kept out of flowLayout.ts, which stays presentation-framework
// agnostic (that's also why these are plain data + one callback, not store
// hooks: a node re-renders from whatever FlowMapView computed this tick).
export interface PageNodeData extends FlowPageNodeData {
  isSnapTarget?: boolean;
  // Whether this page is open in the Builder/Inspector -- distinct from
  // React Flow's own `selected` (which drives Delete-key targeting and must
  // reflect an actual canvas click, not "whatever page is active").
  isActivePage?: boolean;
  autoFocusRename?: boolean;
  onAutoFocusHandled?: () => void;
  // Opens the dot's context menu. A plain native `click` -- not React Flow's
  // own onConnectStart/onConnectEnd lifecycle, which (confirmed by
  // instrumenting it) never fires at all for a truly stationary press, e.g.
  // a trackpad tap with zero pointer movement. A real browser click fires
  // reliably regardless of input device, AND is naturally suppressed by the
  // browser itself when mouseup lands on a different element (a genuine
  // drag-to-connect) -- so no custom movement-distance bookkeeping is needed
  // here at all.
  onTargetDotClick?: (event: MouseEvent<HTMLElement>) => void;
  onSourceDotClick?: (event: MouseEvent<HTMLElement>) => void;
}

export type PageNodeType = Node<PageNodeData, 'pageNode'>;

// Memoized so dragging one node (which updates only that node's object in
// rfNodes -- see FlowMapView's onNodesChange) doesn't re-render every other
// page node on the canvas each frame.
export const PageNode = memo(function PageNode({ id, data, selected }: NodeProps<PageNodeType>) {
  const theme = useTheme();
  const setPageTitle = useBuilderStore((s) => s.setPageTitle);
  const { Icon, color } = resolvePageIcon(data.iconKind);

  const handleStyle = {
    width: 9,
    height: 9,
    background: theme.palette.background.paper,
    border: `2px solid ${theme.palette.primary.main}`,
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data.autoFocusRename && !editing) {
      setDraft(data.title);
      setEditing(true);
      data.onAutoFocusHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.autoFocusRename]);

  useEffect(() => {
    if (!editing) return;
    // A plain rAF loses a focus race against React Flow's own post-render
    // handling (e.g. the pane reclaiming focus after fitView), which can
    // silently leave the "Add page" button focused instead of this input.
    // A short delay lets that settle first.
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 100);
    return () => clearTimeout(timer);
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== data.title) setPageTitle(id, trimmed);
    setEditing(false);
  };

  return (
    <Box
      sx={{
        width: 190,
        borderRadius: 1.5,
        border: '1px solid',
        borderStyle: data.isSnapTarget || data.isUnconnected ? 'dashed' : 'solid',
        borderColor: data.isSnapTarget || data.isActivePage || selected ? 'primary.main' : data.isUnconnected ? 'text.disabled' : 'divider',
        borderWidth: data.isActivePage || selected || data.isSnapTarget ? 2 : 1,
        bgcolor: 'background.paper',
        boxShadow: data.isSnapTarget ? `0 0 0 4px ${theme.palette.primary.light}` : '0 1px 2px rgba(16,24,40,0.04)',
        p: 1.25,
        cursor: 'grab',
        position: 'relative',
      }}
    >
      <Handle
        id="target"
        type="target"
        position={Position.Left}
        style={handleStyle}
        onClick={(e) => {
          e.stopPropagation(); // never also select this node, see handleNodeClick's comment
          data.onTargetDotClick?.(e);
        }}
      />
      <Handle
        id="source"
        type="source"
        position={Position.Right}
        style={handleStyle}
        onClick={(e) => {
          e.stopPropagation();
          data.onSourceDotClick?.(e);
        }}
      />

      {data.flowOrderDiffers && (
        <Tooltip title="This page's position in the list doesn't match where it actually falls in the flow respondents take -- reordering only changes the list, not the branching itself.">
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <SwapVertIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
          </Box>
        </Tooltip>
      )}

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
        {data.isUnconnected && (
          <Chip
            size="small"
            label="NOT CONNECTED"
            sx={{
              height: 18,
              fontSize: 9,
              fontWeight: 700,
              bgcolor: 'transparent',
              color: 'text.disabled',
              border: '1px dashed',
              borderColor: 'text.disabled',
            }}
          />
        )}
        {data.isBranchPoint && (
          <Chip
            size="small"
            label="BRANCH POINT"
            sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'primary.light', color: 'primary.dark' }}
          />
        )}
        {data.isConditionalOnly && !data.isBranchPoint && !data.isUnconnected && (
          <Chip
            size="small"
            label="PAGE"
            sx={{ height: 18, fontSize: 9, fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary' }}
          />
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: 0.75,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <Icon sx={{ fontSize: 14, color }} />
        </Box>
        {editing ? (
          <TextField
            inputRef={inputRef}
            size="small"
            variant="standard"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
              e.stopPropagation();
            }}
            fullWidth
            sx={{ mt: -0.25 }}
          />
        ) : (
          <Typography
            variant="body2"
            fontWeight={700}
            sx={{ lineHeight: 1.3, cursor: 'text' }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(data.title);
              setEditing(true);
            }}
            title="Double-click to rename"
          >
            {data.title}
          </Typography>
        )}
      </Stack>

      {(data.blocksSubmission || data.endsFlow) && (
        <Box
          sx={{
            mt: 1,
            px: 0.75,
            py: 0.4,
            borderRadius: 0.75,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: data.blocksSubmission ? theme.custom.warningBanner.bg : theme.custom.successBanner.bg,
            border: data.blocksSubmission ? `1px solid ${theme.custom.warningBanner.border}` : undefined,
          }}
        >
          {data.blocksSubmission ? (
            <WarningAmberIcon sx={{ fontSize: 13, color: theme.custom.warningBanner.icon }} />
          ) : (
            <CheckCircleOutlineIcon sx={{ fontSize: 13, color: theme.custom.successBanner.text }} />
          )}
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: 10,
              color: data.blocksSubmission ? theme.custom.warningBanner.textStrong : theme.custom.successBanner.text,
            }}
          >
            {data.blocksSubmission ? 'Blocks submission' : 'Ends flow'}
          </Typography>
        </Box>
      )}
    </Box>
  );
});
