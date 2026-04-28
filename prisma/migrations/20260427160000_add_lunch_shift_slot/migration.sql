-- Add LUNCH to the ShiftSlot enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in
-- older Postgres versions; Prisma handles this correctly by running
-- the migration outside one.
ALTER TYPE "ShiftSlot" ADD VALUE 'LUNCH';
