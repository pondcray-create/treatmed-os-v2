-- CreateTable
CREATE TABLE "app_state_blobs" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_state_blobs_pkey" PRIMARY KEY ("key")
);
