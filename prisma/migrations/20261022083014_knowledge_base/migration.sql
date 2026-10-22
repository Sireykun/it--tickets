-- CreateTable
CREATE TABLE "kb_articles" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "help_topic_id" UUID,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_articles_is_published_help_topic_id_idx" ON "kb_articles"("is_published", "help_topic_id");

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_help_topic_id_fkey" FOREIGN KEY ("help_topic_id") REFERENCES "help_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
