-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "customLayout" JSONB,
ADD COLUMN     "customRules" JSONB,
ADD COLUMN     "mode" TEXT;
