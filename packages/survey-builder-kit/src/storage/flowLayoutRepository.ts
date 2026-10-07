import { db, type FlowLayoutRecord } from './db';

export const flowLayoutRepository = {
  get(surveyId: string): Promise<FlowLayoutRecord | undefined> {
    return db.flowLayouts.get(surveyId);
  },
  savePosition(surveyId: string, pageId: string, position: { x: number; y: number }): Promise<string> {
    return db.transaction('rw', db.flowLayouts, async () => {
      const existing = await db.flowLayouts.get(surveyId);
      const positions = { ...(existing?.positions ?? {}), [pageId]: position };
      return db.flowLayouts.put({ surveyId, positions });
    });
  },
  removePosition(surveyId: string, pageId: string): Promise<string | void> {
    return db.transaction('rw', db.flowLayouts, async () => {
      const existing = await db.flowLayouts.get(surveyId);
      if (!existing) return;
      const { [pageId]: _removed, ...positions } = existing.positions;
      return db.flowLayouts.put({ surveyId, positions });
    });
  },
};
