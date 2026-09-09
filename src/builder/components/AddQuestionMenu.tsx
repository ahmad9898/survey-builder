import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { QUESTION_TYPES } from '../questionTypes';
import { QUESTION_TYPE_ICONS } from '../questionTypeIcons';
import type { QuestionType } from '../../types/survey';
import { useBuilderStore } from '../store/builderStore';

export function AddQuestionMenu({ pageId }: { pageId: string }) {
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (type: QuestionType) => {
    addQuestion(pageId, type);
    handleClose();
  };

  return (
    <>
      <Button variant="outlined" startIcon={<AddIcon />} onClick={handleOpen} sx={{ alignSelf: 'flex-start' }}>
        Add question
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {QUESTION_TYPES.map((meta) => {
          const Icon = QUESTION_TYPE_ICONS[meta.type];
          return (
            <MenuItem key={meta.type} onClick={() => handleSelect(meta.type)}>
              <ListItemIcon>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{meta.paletteLabel}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
