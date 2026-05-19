import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { matchIdParamSchema } from '../validation/matches.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';
import { commentary } from '../db/schema.js';
import { db } from '../db/db.js';

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get('/', async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params.', details: parsedParams.error.issues });
  }

  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({ error: 'Invalid query.', details: parsedQuery.error.issues });
  }

  const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ data });
  } catch (e) {
    console.error('GET /matches/:id/commentary failed', e);
    res.status(500).json({ error: 'Failed to list commentary.' });
  }
});

commentaryRouter.post('/', async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params.', details: parsedParams.error.issues });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid payload.', details: parsedBody.error.issues });
  }

  try {
    const [entry] = await db
      .insert(commentary)
      .values({
        matchId: parsedParams.data.id,
        ...parsedBody.data,
      })
      .returning();

      if (!entry) {
             return res.status(500).json({ error: 'Failed to create commentary.' });
          }

    if (typeof res.app.locals.broadcastCommentary === 'function') {
      try {
              res.app.locals.broadcastCommentary(entry.matchId, entry);
             } catch (broadcastError) {
               console.error('Broadcast commentary failed', broadcastError);
           }
    }

    return res.status(201).json({ data: entry });
  } catch (e) {
    console.error('POST /matches/:id/commentary failed', e);
    res.status(500).json({ error: 'Failed to create commentary.' });
  }
});
