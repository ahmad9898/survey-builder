import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  MarkerType,
  type Edge,
  type Connection,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Button, Paper, Stack, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useBuilderStore } from '../../store/builderStore';
import { useFlowLayoutStore } from '../../store/flowLayoutStore';
import { useSnackbarStore } from '../../store/snackbarStore';
import {
  pagesToFlow,
  NODE_WIDTH,
  NODE_HEIGHT,
  START_NODE_ID,
  type FlowPageEdge,
  type FlowPosition,
} from '../../../domain/flowLayout';
import { validateBranchTarget } from '../../../domain/graphValidation';
import { availableFieldsForPage } from '../../conditionFields';
import { confirmDeletePage } from '../../pageActions';
import { newId } from '../../../lib/id';
import type { ConditionLeaf } from '../../../types/survey';
import { PageNode, type PageNodeType } from './PageNode';
import { StartNode } from './StartNode';
import { BranchEdge, type BranchEdgeType } from './BranchEdge';
import { RuleConditionPopover } from './RuleConditionPopover';
import { FlowOverviewPanel } from './FlowOverviewPanel';
import { FlowMapPagePanel } from './FlowMapPagePanel';
import { DotContextMenu, type DotContextMenuState } from './DotContextMenu';
import { ConnectExistingPopover, type ConnectExistingState } from './ConnectExistingPopover';

// The Start pill is a real node in the graph (see flowLayout.ts) but carries
// no page data and is never selectable/draggable/connectable -- it only ever
// exists to mark survey.startPageId.
export type StartNodeType = Node<Record<string, never>, 'startNode'>;
type FlowNode = PageNodeType | StartNodeType;

const nodeTypes = { pageNode: PageNode, startNode: StartNode };
const edgeTypes = { branchEdge: BranchEdge };
const SNAP_THRESHOLD = 90;

function leafOf(rule: { when: { conditions: unknown[] } } | undefined): ConditionLeaf | null {
  return (rule?.when.conditions.find((c) => !(c as { logic?: string }).logic) as ConditionLeaf | undefined) ?? null;
}

function FlowLegend() {
  const theme = useTheme();
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, width: 200 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Legend
      </Typography>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: theme.custom.successBanner.bg,
              border: `1.5px solid ${theme.custom.successBanner.text}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Start
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 20, height: 2, bgcolor: theme.palette.warning.main }} />
          <Typography variant="caption" color="text.secondary">
            Branch · highlighted
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 20, height: 2, bgcolor: theme.palette.text.disabled }} />
          <Typography variant="caption" color="text.secondary">
            Branch · default
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: theme.custom.warningBanner.icon }} />
          <Typography variant="caption" color="text.secondary">
            Blocks submission
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

interface RuleEditorState {
  anchorEl: HTMLElement | null;
  sourcePageId: string;
  targetPageId: string;
  ruleId?: string; // absent -> creating a new rule
  initialLeaf: ConditionLeaf | null;
}

export function FlowMapView() {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const selectPage = useBuilderStore((s) => s.selectPage);
  const clearSelectedPage = useBuilderStore((s) => s.clearSelectedPage);
  const setViewMode = useBuilderStore((s) => s.setViewMode);
  const addPage = useBuilderStore((s) => s.addPage);
  const duplicatePage = useBuilderStore((s) => s.duplicatePage);
  const removePage = useBuilderStore((s) => s.removePage);
  const setStartPage = useBuilderStore((s) => s.setStartPage);
  const reorderPage = useBuilderStore((s) => s.reorderPage);
  const addBranchRule = useBuilderStore((s) => s.addBranchRule);
  const updateBranchRule = useBuilderStore((s) => s.updateBranchRule);
  const removeBranchRule = useBuilderStore((s) => s.removeBranchRule);
  const setDefaultNextPage = useBuilderStore((s) => s.setDefaultNextPage);

  const overrides = useFlowLayoutStore((s) => s.overrides);
  const setOverride = useFlowLayoutStore((s) => s.setOverride);
  const clearOverride = useFlowLayoutStore((s) => s.clearOverride);

  const showError = useSnackbarStore((s) => s.showError);

  const theme = useTheme();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<FlowNode, BranchEdgeType> | null>(null);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);
  const [pendingRenamePageId, setPendingRenamePageId] = useState<string | null>(null);
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState | null>(null);
  // What Delete/Backspace acts on. Tracked ourselves (not left to React
  // Flow's own internal selection) because nodes/edges are recreated fresh
  // from the store on every render -- any selection React Flow set
  // internally would otherwise be wiped the moment something unrelated
  // (e.g. selecting a different page) triggers a re-render.
  const [canvasSelection, setCanvasSelection] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);
  // A dot's context menu and its "connect to existing" search -- deliberately
  // keyed by the clicked node's own id, never by selectedPageId. Clicking a
  // dot must never change (or even read) which page is open in the
  // inspector; these menus act on whichever page actually owns the dot.
  const [dotMenu, setDotMenu] = useState<DotContextMenuState | null>(null);
  const [connectExisting, setConnectExisting] = useState<ConnectExistingState | null>(null);

  // Opens a dot's context menu, in response to a plain native `onClick` on
  // the Handle itself (see PageNode.tsx) -- not React Flow's own
  // onConnectStart/onConnectEnd lifecycle, which (confirmed by
  // instrumenting it) never fires at all for a perfectly stationary press,
  // e.g. a trackpad tap with zero pointer movement between mousedown and
  // mouseup. A native `click` event doesn't have that problem: it fires
  // reliably regardless of input device, and the browser itself already
  // suppresses it when mouseup lands on a different element (a genuine
  // drag-to-connect releases over another node, not back over the dot) --
  // so no custom movement-distance bookkeeping is needed here at all.
  const openDotMenuFor = (pageId: string, handleType: 'source' | 'target') => (event: ReactMouseEvent<HTMLElement>) => {
    const page = survey.pages.find((p) => p.id === pageId);
    if (!page) return;
    setDotMenu({
      anchorEl: event.currentTarget,
      pageId: page.id,
      pageTitle: page.title,
      handleType,
      isStartPage: page.id === survey.startPageId,
    });
  };

  const openEditRuleEditor = (
    sourcePageId: string,
    targetPageId: string,
    ruleId: string,
    initialLeaf: ConditionLeaf | null,
    anchorEl: HTMLElement | null,
  ) => {
    setRuleEditor({ anchorEl, sourcePageId, targetPageId, ruleId, initialLeaf });
  };

  // Shared by the edge's hover-x button and the keyboard Delete path so both
  // ask the same question and perform the same mutation.
  const confirmMessageForEdge = (data: { isDefault: boolean }) =>
    data.isDefault
      ? "Remove this page's default path? It will end the survey here instead of continuing on (use Undo right after if you change your mind)."
      : "Delete this branch rule? This can't be undone by itself (use Undo right after if you change your mind).";

  const applyEdgeDelete = (source: string, data: { isDefault: boolean; ruleId?: string }) => {
    if (data.isDefault) setDefaultNextPage(source, 'end');
    else if (data.ruleId) removeBranchRule(source, data.ruleId);
  };

  const confirmAndDeleteEdge = (edge: { source: string; data: { isDefault: boolean; ruleId?: string } }) => {
    if (!window.confirm(confirmMessageForEdge(edge.data))) return;
    applyEdgeDelete(edge.source, edge.data);
    setCanvasSelection(null);
  };

  // Domain layout (dagre auto-layout + saved overrides) -- deliberately the
  // ONLY thing in this file allowed to run dagre. It depends solely on
  // `survey`/`overrides`, so it's stable for the entire duration of a drag
  // (a drag never touches either until it commits at onNodeDragStop). See
  // the two effects below for how this turns into what's actually rendered.
  const layout = useMemo(() => pagesToFlow(survey, overrides), [survey, overrides]);

  // What's actually fed to <ReactFlow>. Position lives here and ONLY here
  // during an active drag -- see onNodesChange. Rebuilding this from `layout`
  // (or from any other derived/recomputed source) on every render would mean
  // React Flow's controlled `nodes` prop keeps getting reset to a stale
  // pre-drag position on every unrelated re-render (a hover highlight, a
  // selection change, ...), fighting its own internal drag tracking -- which
  // is exactly the "node barely moves, then teleports" symptom this
  // architecture exists to avoid. Seeded/reconciled by the two effects below,
  // never computed inline during render.
  const [rfNodes, setRfNodes] = useState<FlowNode[]>([]);
  const [rfEdges, setRfEdges] = useState<BranchEdgeType[]>([]);

  const buildEdgeData = (e: FlowPageEdge) => {
    const color = e.data.variant === 'positive' ? theme.palette.warning.main : theme.palette.text.disabled;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: 'branchEdge' as const,
      reconnectable: true,
      style: { stroke: color, strokeWidth: 1.75 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      data: {
        ...e.data,
        color,
        onLabelClick: e.data.ruleId
          ? () => {
              const page = survey.pages.find((p) => p.id === e.source);
              const rule = page?.branch.find((r) => r.id === e.data.ruleId);
              const anchorEl = wrapperRef.current?.querySelector<HTMLElement>(
                `.react-flow__node[data-id="${CSS.escape(e.target)}"]`,
              );
              openEditRuleEditor(e.source, e.target, e.data.ruleId!, leafOf(rule), anchorEl ?? null);
            }
          : undefined,
        onDeleteRequest: () => void confirmAndDeleteEdge(e),
      },
    };
  };

  // Structural resync: rebuild node/edge positions and domain data from
  // scratch, but ONLY when something that changes graph structure or
  // content actually changed (a page/edge added, removed, rewired, or the
  // saved-position override committed at drag-stop) -- never mid-drag, and
  // never in response to the in-progress drag position itself.
  useEffect(() => {
    const nodes: PageNodeType[] = layout.nodes.map((n) => ({
      ...n,
      selected: canvasSelection?.type === 'node' && canvasSelection.id === n.id,
      data: {
        ...n.data,
        isActivePage: n.id === selectedPageId,
        isSnapTarget: n.id === snapTargetId,
        autoFocusRename: n.id === pendingRenamePageId,
        onAutoFocusHandled: () => setPendingRenamePageId(null),
        onTargetDotClick: openDotMenuFor(n.id, 'target'),
        onSourceDotClick: openDotMenuFor(n.id, 'source'),
      },
    }));
    const startNode: StartNodeType | null = layout.startMarker
      ? {
          id: layout.startMarker.id,
          type: 'startNode',
          position: layout.startMarker.position,
          data: {},
          draggable: false,
          selectable: false,
          connectable: false,
          focusable: false,
        }
      : null;
    const edges: BranchEdgeType[] = layout.edges.map((e) => ({
      ...buildEdgeData(e),
      selected: canvasSelection?.type === 'edge' && canvasSelection.id === e.id,
    }));
    const startEdge: BranchEdgeType | null = layout.startMarker
      ? {
          id: layout.startMarker.edge.id,
          source: layout.startMarker.edge.source,
          target: layout.startMarker.edge.target,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'branchEdge',
          label: '', // no label/delete affordance -- BranchEdge renders neither when label is falsy
          selectable: false,
          focusable: false,
          deletable: false,
          style: { stroke: theme.custom.successBanner.text, strokeWidth: 1.75 },
          markerEnd: { type: MarkerType.ArrowClosed, color: theme.custom.successBanner.text, width: 16, height: 16 },
          data: { variant: 'neutral', isDefault: false, color: theme.custom.successBanner.text },
        }
      : null;

    setRfNodes(startNode ? [startNode, ...nodes] : nodes);
    setRfEdges(startEdge ? [startEdge, ...edges] : edges);
    // Deliberately NOT depending on selectedPageId/snapTargetId/canvasSelection/
    // pendingRenamePageId -- those are cheap overlays applied by the effect
    // below directly onto whatever rfNodes/rfEdges already holds (preserving
    // any in-progress drag position), not reasons to rebuild from `layout`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, theme]);

  // Overlay-only resync: selection/hover/rename-focus changed, but nothing
  // structural did. Re-map the CURRENT rfNodes/rfEdges (never `layout`), so
  // an in-progress drag's live position is carried through untouched.
  useEffect(() => {
    setRfNodes((nds) =>
      nds.map((n) =>
        n.type !== 'pageNode'
          ? n
          : {
              ...n,
              selected: canvasSelection?.type === 'node' && canvasSelection.id === n.id,
              data: {
                ...n.data,
                isActivePage: n.id === selectedPageId,
                isSnapTarget: n.id === snapTargetId,
                autoFocusRename: n.id === pendingRenamePageId,
                onAutoFocusHandled: () => setPendingRenamePageId(null),
              },
            },
      ),
    );
    setRfEdges((eds) =>
      eds.map((e) => ({ ...e, selected: canvasSelection?.type === 'edge' && canvasSelection.id === e.id })),
    );
  }, [selectedPageId, snapTargetId, canvasSelection, pendingRenamePageId]);

  // The only path that may update rfNodes' *position* during a drag: React
  // Flow's own per-pointermove change events, applied directly to local
  // state. This never touches the store, never re-runs dagre, and is what
  // keeps the node tracking the cursor every frame instead of waiting for a
  // re-derivation to catch up.
  const onNodesChange = (changes: NodeChange<FlowNode>[]) => {
    const relevant = changes.filter((c) => c.type === 'position' || c.type === 'dimensions');
    if (relevant.length === 0) return;
    setRfNodes((nds) => applyNodeChanges(relevant, nds));
  };

  const findSnapTarget = (draggedId: string, position: FlowPosition): PageNodeType | null => {
    let closest: PageNodeType | null = null;
    let closestDist = Infinity;
    for (const n of rfNodes) {
      if (n.type !== 'pageNode') continue;
      if (n.id === draggedId) continue;
      const dx = n.position.x - position.x;
      const dy = n.position.y - position.y;
      const dist = Math.hypot(dx, dy);
      if (dist < SNAP_THRESHOLD && dist < closestDist) {
        closest = n;
        closestDist = dist;
      }
    }
    return closest;
  };

  const closeRuleEditor = () => setRuleEditor(null);

  const openNewRuleEditor = (sourcePageId: string, targetPageId: string, fallbackAnchorEl?: HTMLElement | null) => {
    // The target page may not exist in the DOM yet (e.g. it was just this
    // instant created by a dot menu's "Add page"/"Duplicate page", and React
    // hasn't committed its node) -- fall back to wherever the gesture that
    // triggered this actually originated (the clicked dot) rather than
    // anchoring nowhere.
    const anchorEl = wrapperRef.current?.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(targetPageId)}"]`,
    );
    setRuleEditor({ anchorEl: anchorEl ?? fallbackAnchorEl ?? null, sourcePageId, targetPageId, initialLeaf: null });
  };

  const handleSaveRule = (leaf: ConditionLeaf) => {
    if (!ruleEditor) return;
    const when = { logic: 'AND' as const, conditions: [leaf] };
    if (ruleEditor.ruleId) {
      updateBranchRule(ruleEditor.sourcePageId, ruleEditor.ruleId, { when, goToPageId: ruleEditor.targetPageId });
    } else {
      addBranchRule(ruleEditor.sourcePageId, { id: newId('branch'), when, goToPageId: ruleEditor.targetPageId });
    }
    closeRuleEditor();
  };

  // The single place that decides "does this new edge need a condition" --
  // used identically by drag-to-connect (via onConnect below) AND every dot
  // menu action that creates an edge (Add page / Duplicate page / Connect to
  // existing page). None of those special-case the branching decision; they
  // all just build a Connection and hand it here. fallbackAnchorEl is purely
  // presentational (where to anchor the condition popover if it's needed and
  // the target node isn't in the DOM yet) and never affects the decision.
  const handleConnect = (connection: Connection, fallbackAnchorEl?: HTMLElement | null) => {
    if (!connection.source || !connection.target) return;
    // Reads the LATEST survey, not the possibly-stale one closed over from
    // this render: a dot menu's "Add page"/"Duplicate page" calls addPage()/
    // duplicatePage() (a synchronous store mutation) immediately before
    // this, in the same handler, and React doesn't re-render (so the
    // component-level `survey` variable doesn't refresh) until after this
    // function returns -- validating against the stale value would reject
    // the page this very call just created as nonexistent.
    const survey = useBuilderStore.getState().survey;
    const validation = validateBranchTarget(survey, connection.source, connection.target);
    if (!validation.valid) {
      showError(validation.reason ?? 'That branch is not allowed.');
      return;
    }
    const sourcePage = survey.pages.find((p) => p.id === connection.source);
    const sourceHasOutgoingEdge = !!sourcePage && (sourcePage.defaultNextPageId !== 'end' || sourcePage.branch.length > 0);
    if (!sourceHasOutgoingEdge) {
      // This page's first-ever connection: stays condition-free, exactly
      // like setting "Otherwise, go to" from the sidebar -- no popover.
      // Only a SECOND+ connection from the same page needs a condition
      // (enforced by the store: a lone edge always reverts to this same
      // plain default if it's ever brought back down to one).
      setDefaultNextPage(connection.source, connection.target);
      return;
    }
    openNewRuleEditor(connection.source, connection.target, fallbackAnchorEl);
  };

  // React Flow 12.11.6's own `onReconnect(oldEdge, newConnection)` reports the
  // FIXED endpoint for *both* connection.source and connection.target on this
  // gesture (confirmed by instrumenting it -- newConnection.target never
  // reflects the actual drop node), so it can't be trusted to build the new
  // edge. Instead, `onReconnectEnd` is used: the raw mouse event's client
  // coordinates are converted to flow-space via React Flow's own
  // `screenToFlowPosition` (connectionState.to turned out to be wrapper-
  // relative screen pixels, not flow coordinates -- comparing it directly to
  // node.position silently missed every node), and the new endpoint is
  // resolved here directly against our own node positions.
  const handleReconnectEnd = (
    event: MouseEvent | TouchEvent,
    oldEdge: BranchEdgeType,
    handleType: 'source' | 'target',
  ) => {
    const client = 'clientX' in event ? event : event.changedTouches?.[0];
    if (!client) return;
    const instance = reactFlowInstanceRef.current;
    if (!instance) return;
    const dropPoint = instance.screenToFlowPosition({ x: client.clientX, y: client.clientY });

    const droppedNode = rfNodes.find(
      (n) =>
        dropPoint.x >= n.position.x &&
        dropPoint.x <= n.position.x + NODE_WIDTH &&
        dropPoint.y >= n.position.y &&
        dropPoint.y <= n.position.y + NODE_HEIGHT,
    );
    if (!droppedNode) return; // dropped on empty canvas -- leave the edge as-is

    // handleType names the FIXED end: 'source' means the edge's source held
    // still and the target end was dragged (the supported case: "retarget
    // this branch's destination"); 'target' would mean re-sourcing the edge
    // to a different origin page, which isn't offered here -- reparenting a
    // rule/default between pages has murkier semantics than this drag
    // conveys, so it's a deliberate no-op rather than a guess.
    if (handleType !== 'source') return;

    const newSource = oldEdge.source;
    const newTarget = droppedNode.id;
    if (newTarget === oldEdge.target) return; // dropped back where it started

    const validation = validateBranchTarget(survey, newSource, newTarget);
    if (!validation.valid) {
      showError(validation.reason ?? 'That branch is not allowed.');
      return;
    }

    if (oldEdge.data?.isDefault) {
      setDefaultNextPage(newSource, newTarget);
      return;
    }
    const ruleId = oldEdge.data?.ruleId;
    if (!ruleId) return;
    const page = survey.pages.find((p) => p.id === newSource);
    const rule = page?.branch.find((r) => r.id === ruleId);
    const anchorEl = wrapperRef.current?.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${CSS.escape(newTarget)}"]`,
    );
    openEditRuleEditor(newSource, newTarget, ruleId, leafOf(rule), anchorEl ?? null);
  };

  // --- Dot click vs. drag-to-connect disambiguation -------------------
  const closeDotMenu = () => setDotMenu(null);

  // Builds the Connection a dot's menu action implies, in the right
  // direction for which dot was clicked, then hands it to the exact same
  // handleConnect used by drag-to-connect -- no separate branching logic.
  const connectionForDot = (menuPageId: string, handleType: 'source' | 'target', otherPageId: string): Connection =>
    handleType === 'source'
      ? { source: menuPageId, target: otherPageId, sourceHandle: 'source', targetHandle: 'target' }
      : { source: otherPageId, target: menuPageId, sourceHandle: 'source', targetHandle: 'target' };

  const handleDotAddPage = () => {
    if (!dotMenu) return;
    const { pageId, handleType, anchorEl } = dotMenu;
    addPage();
    const newPageId = useBuilderStore.getState().selectedPageId;
    closeDotMenu();
    if (!newPageId) return;
    handleConnect(connectionForDot(pageId, handleType, newPageId), anchorEl);
  };

  const handleDotDuplicate = () => {
    if (!dotMenu) return;
    const { pageId, handleType, anchorEl } = dotMenu;
    duplicatePage(pageId);
    const copyId = useBuilderStore.getState().selectedPageId;
    closeDotMenu();
    if (!copyId) return;
    handleConnect(connectionForDot(pageId, handleType, copyId), anchorEl);
  };

  const handleDotSetAsStart = () => {
    if (!dotMenu) return;
    setStartPage(dotMenu.pageId);
    closeDotMenu();
  };

  const handleDotDelete = () => {
    if (!dotMenu) return;
    const { pageId, pageTitle } = dotMenu;
    closeDotMenu();
    if (survey.pages.length <= 1) {
      showError('A survey needs at least one page.');
      return;
    }
    if (confirmDeletePage(survey, pageId, pageTitle)) removePage(pageId);
  };

  // Every existing page that this dot could validly link to -- self and any
  // target that would create a cycle are excluded via the same
  // validateBranchTarget check drag-to-connect uses, so every item offered
  // in the search list is already guaranteed valid.
  const connectExistingCandidates = (pageId: string, handleType: 'source' | 'target') =>
    survey.pages
      .filter((p) => p.id !== pageId)
      .filter((p) => {
        const connection = connectionForDot(pageId, handleType, p.id);
        if (!connection.source || !connection.target) return false;
        return validateBranchTarget(survey, connection.source, connection.target).valid;
      })
      .map((p) => ({ id: p.id, title: p.title }));

  const handleOpenConnectExisting = () => {
    if (!dotMenu) return;
    const { pageId, pageTitle, handleType, anchorEl } = dotMenu;
    setConnectExisting({
      anchorEl,
      pageId,
      pageTitle,
      handleType,
      candidates: connectExistingCandidates(pageId, handleType),
    });
    closeDotMenu();
  };

  const closeConnectExisting = () => setConnectExisting(null);

  const handleSelectConnectExisting = (otherPageId: string) => {
    if (!connectExisting) return;
    const { pageId, handleType, anchorEl } = connectExisting;
    closeConnectExisting();
    handleConnect(connectionForDot(pageId, handleType, otherPageId), anchorEl);
  };

  const handleNodeDrag = (_: unknown, node: FlowNode) => {
    if (node.type !== 'pageNode') return; // the Start pill is draggable: false, but guard anyway
    const target = findSnapTarget(node.id, node.position);
    setSnapTargetId(target?.id ?? null);
  };

  const handleNodeDragStop = (_: unknown, node: FlowNode) => {
    if (node.type !== 'pageNode') return;
    const target = findSnapTarget(node.id, node.position);
    setSnapTargetId(null);

    if (target) {
      const fromIndex = survey.pages.findIndex((p) => p.id === node.id);
      const targetIndex = survey.pages.findIndex((p) => p.id === target.id);
      if (fromIndex === -1 || targetIndex === -1) return;
      const insertBefore = node.position.x <= target.position.x;
      let toIndex = insertBefore ? targetIndex : targetIndex + 1;
      if (fromIndex < toIndex) toIndex -= 1;
      toIndex = Math.max(0, Math.min(toIndex, survey.pages.length - 1));
      if (toIndex !== fromIndex) reorderPage(fromIndex, toIndex);
      clearOverride(node.id);
    } else {
      setOverride(node.id, node.position);
    }
  };

  const handleNodeClick: NodeMouseHandler<FlowNode> = (event, node) => {
    if (node.type !== 'pageNode') return; // the Start pill isn't selectable, but guard anyway
    // A click that lands on (or inside) a connection dot is never "select
    // this node" -- it's handled entirely by handleConnectStart/
    // handleConnectEnd above (open the dot's menu, or do nothing for an
    // aborted drag). Without this guard, the native click synthesized by a
    // near-zero-movement press-and-release on a handle still bubbles up to
    // this handler too, silently making that page "active" a moment before
    // whatever the dot menu does next -- e.g. briefly selecting a page right
    // before deleting it, which then reassigns selectedPageId away from
    // whatever page actually was active in the inspector.
    if ((event.target as HTMLElement).closest('.react-flow__handle')) return;
    selectPage(node.id);
    setCanvasSelection({ type: 'node', id: node.id });
  };

  const handleNodeDoubleClick: NodeMouseHandler<FlowNode> = (event, node) => {
    if (node.type !== 'pageNode') return;
    if ((event.target as HTMLElement).closest('.react-flow__handle')) return; // see handleNodeClick's comment
    selectPage(node.id);
    setViewMode('builder');
  };

  const handleEdgeClick = (_: unknown, edge: BranchEdgeType) => {
    setCanvasSelection({ type: 'edge', id: edge.id });
  };

  const handlePaneClick = () => {
    setCanvasSelection(null);
    clearSelectedPage();
  };

  // Esc reverts the panel to the overview, unless the rule-condition popover,
  // a dot's context menu, or its "connect to existing" search is open --
  // MUI's Menu/Popover already close themselves on Esc, and letting this
  // ALSO fire on the same keypress would collapse the panel out from under
  // whatever those are editing (same reasoning as the ruleEditor guard).
  useEffect(() => {
    if (ruleEditor || dotMenu || connectExisting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelectedPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ruleEditor, dotMenu, connectExisting, clearSelectedPage]);

  const handleAddPage = () => {
    addPage();
    const newPageId = useBuilderStore.getState().selectedPageId;
    // The new node may land outside the current viewport (it's appended past
    // whatever the layout already fanned out); bring it into view *before*
    // triggering the rename auto-focus below, so there's no animated pan
    // still in flight fighting the input for focus.
    reactFlowInstanceRef.current?.fitView({ padding: 0.3, duration: 0 });
    requestAnimationFrame(() => setPendingRenamePageId(newPageId));
  };

  const isValidConnection = (edgeOrConnection: Edge | Connection) => {
    const source = 'source' in edgeOrConnection ? edgeOrConnection.source : undefined;
    const target = 'target' in edgeOrConnection ? edgeOrConnection.target : undefined;
    if (!source || !target) return false;
    return validateBranchTarget(survey, source, target).valid;
  };

  const ruleEditorFields = ruleEditor ? availableFieldsForPage(survey, ruleEditor.sourcePageId) : [];
  const ruleEditorDestination = ruleEditor ? survey.pages.find((p) => p.id === ruleEditor.targetPageId)?.title ?? '' : '';

  return (
    <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
    <Box ref={wrapperRef} sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        // A real handler is required here only because React Flow gates
        // rendering the reconnect anchors on `typeof onReconnect !==
        // 'undefined'` -- the actual retarget logic lives in
        // onReconnectEnd (see its comment for why).
        onReconnect={() => {}}
        onReconnectEnd={handleReconnectEnd}
        edgesReconnectable
        isValidConnection={isValidConnection}
        onBeforeDelete={async ({ nodes: nodesToDelete, edges: edgesToDelete }) => {
          const approvedNodes = nodesToDelete.filter((n) => {
            if (n.id === START_NODE_ID) return false; // not a real page; not selectable, but guard anyway
            if (survey.pages.length <= 1) {
              showError('A survey needs at least one page.');
              return false;
            }
            return confirmDeletePage(survey, n.id, (n.data as { title: string }).title);
          });
          // removePage() already strips any rule/default pointing at a
          // deleted page, so an edge that's only in this batch because
          // React Flow cascades node-delete to its incident edges doesn't
          // need (or want) its own separate confirmation.
          const deletingNodeIds = new Set(nodesToDelete.map((n) => n.id));
          const approvedEdges = edgesToDelete
            .filter((e) => !deletingNodeIds.has(e.source) && !deletingNodeIds.has(e.target))
            .filter((e) => window.confirm(confirmMessageForEdge(e.data as { isDefault: boolean })));
          if (approvedNodes.length === 0 && approvedEdges.length === 0) return false;
          return { nodes: approvedNodes, edges: approvedEdges };
        }}
        onNodesDelete={(deleted) => {
          for (const n of deleted) removePage(n.id);
          setCanvasSelection(null);
        }}
        onEdgesDelete={(deleted) => {
          for (const e of deleted) applyEdgeDelete(e.source, e.data as { isDefault: boolean; ruleId?: string });
          setCanvasSelection(null);
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color={theme.palette.divider} gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable style={{ background: theme.palette.background.paper }} />
        <Panel position="top-left">
          <FlowLegend />
        </Panel>
        <Panel position="bottom-left">
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon fontSize="small" />}
            onClick={handleAddPage}
            sx={{ bgcolor: 'background.paper' }}
          >
            Add page
          </Button>
        </Panel>
      </ReactFlow>
      <RuleConditionPopover
        open={ruleEditor !== null}
        anchorEl={ruleEditor?.anchorEl ?? null}
        fields={ruleEditorFields}
        initialLeaf={ruleEditor?.initialLeaf}
        destinationLabel={ruleEditorDestination}
        onClose={closeRuleEditor}
        onSave={handleSaveRule}
        onEditFullRule={
          ruleEditor
            ? () => {
                // Selecting the page opens it in this same view's panel (see
                // FlowMapPagePanel), which mounts the identical BranchEditor
                // with its full multi-condition editor -- no need to leave
                // the flow map for this anymore.
                selectPage(ruleEditor.sourcePageId);
                closeRuleEditor();
              }
            : undefined
        }
      />
      <DotContextMenu
        state={dotMenu}
        onClose={closeDotMenu}
        onAddPage={handleDotAddPage}
        onConnectExisting={handleOpenConnectExisting}
        onSetAsStart={handleDotSetAsStart}
        onDuplicate={handleDotDuplicate}
        onDelete={handleDotDelete}
      />
      <ConnectExistingPopover
        state={connectExisting}
        onClose={closeConnectExisting}
        onSelect={handleSelectConnectExisting}
      />
    </Box>
    {selectedPageId ? (
      <FlowMapPagePanel pageId={selectedPageId} onClose={clearSelectedPage} />
    ) : (
      <FlowOverviewPanel />
    )}
    </Box>
  );
}
