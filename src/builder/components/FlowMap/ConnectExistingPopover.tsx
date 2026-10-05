import { useState } from 'react';
import { Box, List, ListItemButton, ListItemText, Popover, TextField, Typography } from '@mui/material';

export interface ConnectExistingCandidate {
  id: string;
  title: string;
}

export interface ConnectExistingState {
  anchorEl: HTMLElement;
  pageId: string;
  pageTitle: string;
  handleType: 'source' | 'target';
  candidates: ConnectExistingCandidate[];
}

// A searchable list of existing pages to link to, as an alternative to
// creating a new one -- for a page that already exists (often an orphaned
// "Not connected" page) but is awkward to drag to because it's off-screen
// or the canvas is cluttered. `candidates` arrives already direction-aware
// filtered (self and any cycle-creating target excluded via the same
// validateBranchTarget check drag-to-connect uses), so every entry here is
// always a valid choice.
export function ConnectExistingPopover({
  state,
  onClose,
  onSelect,
}: {
  state: ConnectExistingState | null;
  onClose: () => void;
  onSelect: (pageId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const isTarget = state?.handleType === 'target';

  const filtered = (state?.candidates ?? []).filter((c) => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <Popover
      open={state !== null}
      anchorEl={state?.anchorEl ?? null}
      onClose={() => {
        setQuery('');
        onClose();
      }}
      anchorOrigin={{ vertical: 'center', horizontal: isTarget ? 'left' : 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: isTarget ? 'right' : 'left' }}
    >
      <Box sx={{ width: 260, p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Connect {state?.pageTitle} {isTarget ? 'from' : 'to'} an existing page
        </Typography>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="Search pages…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <List dense sx={{ maxHeight: 260, overflowY: 'auto', mt: 0.5 }}>
          {state && state.candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
              No other pages can be linked here.
            </Typography>
          )}
          {state && state.candidates.length > 0 && filtered.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 1 }}>
              No pages match "{query}".
            </Typography>
          )}
          {filtered.map((c) => (
            <ListItemButton
              key={c.id}
              onClick={() => {
                setQuery('');
                onSelect(c.id);
              }}
            >
              <ListItemText primary={c.title} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Popover>
  );
}
