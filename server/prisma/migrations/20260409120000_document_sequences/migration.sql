-- Bảng đếm tuần tự — đồng bộ số SO/PR/RFQ/PO draft/PX không trùng khi concurrent
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "sequence_key" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_sequences_sequence_key_key" ON "document_sequences"("sequence_key");
