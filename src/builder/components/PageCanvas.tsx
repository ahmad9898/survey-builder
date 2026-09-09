import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Stack, Typography } from '@mui/material';
import { useBuilderStore } from '../store/builderStore';
import { QuestionCard } from './QuestionCard';
import { AddQuestionMenu } from './AddQuestionMenu';
import { BranchEditor } from './BranchEditor';

export function PageCanvas() {
  const survey = useBuilderStore((s) => s.survey);
  const selectedPageId = useBuilderStore((s) => s.selectedPageId);
  const page = survey.pages.find((p) => p.id === selectedPageId);

  const { setNodeRef, isOver } = useDroppable({
    id: `page-canvas-${selectedPageId}`,
    data: { pageId: selectedPageId },
  });

  if (!page) return null;

  return (
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto' }}>
      <Box
        ref={setNodeRef}
        sx={{
          minHeight: 200,
          p: page.questions.length === 0 ? 4 : 0,
          border: page.questions.length === 0 ? '1px dashed' : undefined,
          borderColor: isOver ? 'primary.main' : 'divider',
          borderRadius: 1,
          bgcolor: isOver ? 'action.hover' : undefined,
        }}
      >
        {page.questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            This page has no questions yet. Add one below to get started.
          </Typography>
        ) : (
          <SortableContext
            items={page.questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <Stack spacing={1.5}>
              {page.questions.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </Stack>
          </SortableContext>
        )}
      </Box>
      <Box sx={{ mt: 2 }}>
        <AddQuestionMenu pageId={page.id} />
      </Box>
      <BranchEditor key={page.id} pageId={page.id} />
    </Box>
  );
}
