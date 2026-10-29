import { TEMPLATES } from '@canvas/shared';
import { prisma } from '../lib/prisma';

/** Upserts the built-in templates so code is the source of truth for their contents. */
export async function seedTemplates() {
  await prisma.$transaction(
    TEMPLATES.map((t, i) =>
      prisma.template.upsert({
        where: { id: t.id },
        create: { id: t.id, name: t.name, category: t.category, background: t.background, content: { elements: t.elements }, sortOrder: i },
        update: { name: t.name, category: t.category, background: t.background, content: { elements: t.elements }, sortOrder: i },
      }),
    ),
  );
}
