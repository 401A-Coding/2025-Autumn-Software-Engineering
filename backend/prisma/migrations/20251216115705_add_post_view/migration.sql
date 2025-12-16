-- CreateTable
CREATE TABLE "PostView" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostView_userId_idx" ON "PostView"("userId");

-- CreateIndex
CREATE INDEX "PostView_updatedAt_idx" ON "PostView"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostView_postId_userId_key" ON "PostView"("postId", "userId");

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
