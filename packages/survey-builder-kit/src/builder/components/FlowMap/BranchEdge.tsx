import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { Box, IconButton, Tooltip, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface BranchEdgeData extends Record<string, unknown> {
  variant: 'positive' | 'neutral' | 'disqualifying';
  isDefault: boolean;
  ruleId?: string;
  color: string;
  onLabelClick?: () => void;
  onDeleteRequest?: () => void;
}

export type BranchEdgeType = Edge<BranchEdgeData, 'branchEdge'>;

// Custom edge so the label and its delete "x" are distinct, individually
// clickable DOM elements -- more reliable (for a real pointer, not just
// tests) than inferring "clicked the label vs. the path" from event.target
// on React Flow's default edge. Selecting the edge (a click anywhere on its
// path or label) is the primary, keyboard-friendly path to deleting it: the
// stroke visibly thickens and gets a glow, and the "x" stays shown rather
// than needing a precise hover.
// Memoized for the same reason PageNode is: dragging a node updates rfEdges'
// object identity for edges whose endpoint moved, and edges unrelated to the
// drag shouldn't re-render on every frame just because the array did.
export const BranchEdge = memo(function BranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  markerEnd,
  style,
  selected,
}: EdgeProps<BranchEdgeType>) {
  const theme = useTheme();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const selectedStyle = selected
    ? {
        ...style,
        strokeWidth: 3.5,
        filter: `drop-shadow(0 0 3px ${theme.palette.primary.main})`,
      }
    : style;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={selectedStyle} />
      {(label || data?.ruleId || data?.isDefault) ? (
        <EdgeLabelRenderer>
          <Box
            sx={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              '&:hover .edge-delete-btn': { opacity: 1 },
            }}
            className="nodrag nopan"
          >
            {label && (
              <Box
                component="button"
                onClick={(e) => {
                  e.stopPropagation();
                  data?.onLabelClick?.();
                }}
                sx={{
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  color: data?.color,
                  bgcolor: 'background.default',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  border: selected ? '1.5px solid' : 'none',
                  borderColor: 'primary.main',
                  cursor: data?.onLabelClick ? 'pointer' : 'default',
                }}
              >
                {label}
              </Box>
            )}
            {(data?.ruleId || data?.isDefault) && (
              <Tooltip title="Delete this connection">
                <IconButton
                  className="edge-delete-btn"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    data?.onDeleteRequest?.();
                  }}
                  sx={{
                    // Without a label to sit next to, this is the edge's only
                    // affordance at its midpoint -- stays visible once
                    // selected rather than requiring a precise hover, same
                    // as the labeled case.
                    opacity: selected ? 1 : 0,
                    transition: 'opacity 0.15s',
                    width: 18,
                    height: 18,
                    bgcolor: selected ? 'error.main' : 'background.paper',
                    color: selected ? 'error.contrastText' : 'inherit',
                    border: '1px solid',
                    borderColor: selected ? 'error.main' : 'divider',
                    '&:hover': { bgcolor: 'error.main', color: 'error.contrastText', borderColor: 'error.main' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
