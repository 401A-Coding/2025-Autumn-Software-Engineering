-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "isEndgame" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Board_isEndgame_idx" ON "Board"("isEndgame");
