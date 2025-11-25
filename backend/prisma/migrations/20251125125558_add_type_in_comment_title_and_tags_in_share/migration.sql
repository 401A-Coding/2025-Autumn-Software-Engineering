-- AlterTable
ALTER TABLE "RecordComment" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'static';

-- AlterTable
ALTER TABLE "RecordShare" ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "title" TEXT;
