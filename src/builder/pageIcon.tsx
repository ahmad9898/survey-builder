import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { PageIconKind } from '../domain/flowLayout';
import { QUESTION_TYPE_ICONS } from './questionTypeIcons';

// Maps a page's derived icon kind (see domain/flowLayout.ts `pageIconKind`) to
// the actual icon component + color, shared by the sidebar row and the flow
// map node so both surfaces read as the same visual language.
export function resolvePageIcon(kind: PageIconKind): {
  Icon: typeof DescriptionOutlinedIcon;
  color: string;
} {
  if (kind === 'warning') return { Icon: WarningAmberIcon, color: 'warning.main' };
  if (kind === 'branch') return { Icon: CallSplitIcon, color: 'primary.main' };
  if (kind === 'empty') return { Icon: DescriptionOutlinedIcon, color: 'text.secondary' };
  return { Icon: QUESTION_TYPE_ICONS[kind], color: 'text.secondary' };
}
