import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export interface DotContextMenuState {
  anchorEl: HTMLElement;
  // The page that owns the clicked dot -- deliberately independent of
  // selectedPageId (the inspector's "active page"). Every action here acts
  // on THIS page, never on whatever happens to be open in the inspector.
  pageId: string;
  pageTitle: string;
  handleType: 'source' | 'target';
  isStartPage: boolean;
}

export function DotContextMenu({
  state,
  onClose,
  onAddPage,
  onConnectExisting,
  onSetAsStart,
  onDuplicate,
  onDelete,
}: {
  state: DotContextMenuState | null;
  onClose: () => void;
  onAddPage: () => void;
  onConnectExisting: () => void;
  onSetAsStart: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const isTarget = state?.handleType === 'target';

  return (
    <Menu
      open={state !== null}
      anchorEl={state?.anchorEl ?? null}
      onClose={onClose}
      anchorOrigin={{ vertical: 'center', horizontal: isTarget ? 'left' : 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: isTarget ? 'right' : 'left' }}
    >
      {/* Which page this menu acts on -- explicit so it's never mistaken for
          whatever page the inspector panel currently has open. */}
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }} noWrap>
        {state?.pageTitle} · {isTarget ? 'incoming' : 'outgoing'}
      </Typography>
      <Divider />
      <MenuItem onClick={onAddPage} dense>
        <ListItemIcon>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Add page</ListItemText>
      </MenuItem>
      <MenuItem onClick={onConnectExisting} dense>
        <ListItemIcon>
          <LinkIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Connect to existing page…</ListItemText>
      </MenuItem>
      {isTarget && !state?.isStartPage && (
        <MenuItem onClick={onSetAsStart} dense>
          <ListItemIcon>
            <PlayArrowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Set as start page</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={onDuplicate} dense>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Duplicate page</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={onDelete} dense sx={{ color: 'error.main' }}>
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>Delete page</ListItemText>
      </MenuItem>
    </Menu>
  );
}
