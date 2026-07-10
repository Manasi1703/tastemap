-- Local CLIP zero-shot classification scores, used for aesthetic-similarity graph edges.
alter table captures add column if not exists style_scores jsonb;
