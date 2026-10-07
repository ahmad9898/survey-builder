import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Box, Stack, Typography } from '@mui/material';
import { useBuilderStore } from '../store/builderStore';
import { QuestionCard } from './QuestionCard';
import { AddQuestionMenu } from './AddQuestionMenu';
import type { SurveyPage } from '../../types/survey';

// The question list + editor for one page: droppable/reorderable cards plus
// the "+ Add question" menu. Self-contained (owns its own DndContext) so any
// view can mount it directly -- Builder's PageCanvas and the flow map's
// page panel both render this exact component, not two copies that could
// drift apart.
export function QuestionListEditor({ page }: { page: SurveyPage }) {
  const reorderQuestion = useBuilderStore((s) => s.reorderQuestion);

  const { setNodeRef, isOver } = useDroppable({
    id: `page-canvas-${page.id}`,
    data: { pageId: page.id },
  });

  // A distance threshold lets plain clicks on question cards pass through
  // untouched; only pointer movement past 8px starts a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = page.questions.findIndex((q) => q.id === active.id);
    const toIndex = page.questions.findIndex((q) => q.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderQuestion(page.id, fromIndex, toIndex);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Box
        ref={setNodeRef}
        sx={{
          minHeight: 120,
          p: page.questions.length === 0 ? 4 : 0,
          border: page.questions.length === 0 ? '1px dashed' : undefined,
          borderColor: isOver ? 'primary.main' : 'divider',
          borderRadius: 1.5,
          bgcolor: isOver ? 'primary.light' : undefined,
        }}
      >
        {page.questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            This page has no questions yet. Add one below to get started.
          </Typography>
        ) : (
          <SortableContext items={page.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={1.5}>
              {page.questions.map((q) => (
                <QuestionCard key={q.id} question={q} isBlockingPage={!!page.blocksSubmission} />
              ))}
            </Stack>
          </SortableContext>
        )}
      </Box>

      <Box sx={{ mt: 2 }}>
        <AddQuestionMenu pageId={page.id} />
      </Box>
    </DndContext>
  );
}
