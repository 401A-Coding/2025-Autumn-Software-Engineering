-- CreateTable
CREATE TABLE "Record" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "opponent" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "endReason" TEXT NOT NULL,
    "keyTags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Move" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "moveIndex" INTEGER NOT NULL,
    "fromX" INTEGER NOT NULL,
    "fromY" INTEGER NOT NULL,
    "toX" INTEGER NOT NULL,
    "toY" INTEGER NOT NULL,
    "pieceType" TEXT NOT NULL,
    "pieceSide" TEXT NOT NULL,
    "capturedType" TEXT,
    "capturedSide" TEXT,
    "timeSpentMs" INTEGER NOT NULL,
    "san" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Move_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordComment" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordFavorite" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordShare" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRecordPreference" (
    "userId" INTEGER NOT NULL,
    "retentionLimit" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRecordPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Record_ownerId_idx" ON "Record"("ownerId");

-- CreateIndex
CREATE INDEX "Record_startedAt_idx" ON "Record"("startedAt");

-- CreateIndex
CREATE INDEX "Move_recordId_idx" ON "Move"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "Move_recordId_moveIndex_key" ON "Move"("recordId", "moveIndex");

-- CreateIndex
CREATE INDEX "Bookmark_recordId_idx" ON "Bookmark"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_recordId_step_key" ON "Bookmark"("recordId", "step");

-- CreateIndex
CREATE INDEX "RecordComment_recordId_idx" ON "RecordComment"("recordId");

-- CreateIndex
CREATE INDEX "RecordComment_authorId_idx" ON "RecordComment"("authorId");

-- CreateIndex
CREATE INDEX "RecordFavorite_userId_idx" ON "RecordFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordFavorite_recordId_userId_key" ON "RecordFavorite"("recordId", "userId");

-- CreateIndex
CREATE INDEX "RecordShare_recordId_idx" ON "RecordShare"("recordId");

-- CreateIndex
CREATE INDEX "RecordShare_userId_idx" ON "RecordShare"("userId");

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Move" ADD CONSTRAINT "Move_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordFavorite" ADD CONSTRAINT "RecordFavorite_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordFavorite" ADD CONSTRAINT "RecordFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordShare" ADD CONSTRAINT "RecordShare_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordShare" ADD CONSTRAINT "RecordShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRecordPreference" ADD CONSTRAINT "UserRecordPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
