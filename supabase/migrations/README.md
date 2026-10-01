# Notion Resource Manager Migration

## Manual Migration Instructions

Due to migration history conflicts, the Notion Resource Manager schema needs to be applied manually.

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/cmcbkatdyhunlvlktwlv
2. Navigate to SQL Editor
3. Copy and paste the contents of `20260213051103_notion_resource_manager_schema.sql`
4. Execute the SQL

### Option 2: Using Supabase CLI (if migration history is fixed)

```bash
supabase db push
```

### What This Migration Creates

- **Tables**: pages, files, page_shares, templates
- **Indexes**: Optimized indexes for queries and full-text search
- **RLS Policies**: Row-level security for all tables
- **Full-Text Search**: PostgreSQL tsvector with automatic updates
- **Storage Bucket**: page-files bucket with 10MB limit
- **System Templates**: 5 pre-built templates (Notes, Study Plan, Project Tracker, Reading List, Flashcard Set)
- **Helper Functions**: generate_share_link(), update_page_search_vector(), update_updated_at_column()

### Verification

After applying the migration, verify the tables exist:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pages', 'files', 'page_shares', 'templates');
```

Verify the storage bucket exists:

```sql
SELECT * FROM storage.buckets WHERE id = 'page-files';
```
