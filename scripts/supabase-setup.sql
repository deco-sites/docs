-- Enable pgvector extension
create extension if not exists vector;

-- Create table for documentation chunks
create table if not exists doc_chunks (
  id bigserial primary key,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector(1536), -- text-embedding-3-small dimension
  created_at timestamptz default now()
);

-- Create index for similarity search
create index if not exists doc_chunks_embedding_idx
  on doc_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Create index on metadata for filtering
create index if not exists doc_chunks_metadata_idx
  on doc_chunks
  using gin (metadata);

-- Function for similarity search
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_metadata jsonb default '{}'
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    doc_chunks.id,
    doc_chunks.content,
    doc_chunks.metadata,
    1 - (doc_chunks.embedding <=> query_embedding) as similarity
  from doc_chunks
  where
    1 - (doc_chunks.embedding <=> query_embedding) > match_threshold
    and (filter_metadata = '{}' or doc_chunks.metadata @> filter_metadata)
  order by doc_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Function to delete docs by source file (useful for re-indexing)
create or replace function delete_docs_by_source(source_path text)
returns void
language plpgsql
as $$
begin
  delete from doc_chunks where metadata->>'source' = source_path;
end;
$$;
