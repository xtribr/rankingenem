# Database Migrations

SQL migrations for the X-TRI Escolas Supabase database.

## Migration Files

| File | Description | Status |
|------|-------------|--------|
| `001_optimize_schema.sql` | RLS optimization, new tables, indexes | Ready |

## How to Run

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/rqzxcturezryjbwsptld
2. Go to **SQL Editor**
3. Copy and paste the migration content
4. Click **Run**

## Schema Overview

### Tables

```
public.
├── profiles            # User accounts (linked to auth.users)
├── school_skills       # Skills performance per school/year
├── schools             # Master school data
└── enem_results        # Yearly ENEM results per school
```

### Materialized Views

```
public.
├── mv_ranking_nacional    # Cached rankings (refresh after data import)
└── mv_school_evolution    # Historical school performance
```

### Helper Functions

- `calculate_tri_score(theta, mean, sd)` - Convert theta to TRI score
- `get_school_ranking(codigo_inep, ano)` - Get school's rankings
- `refresh_materialized_views()` - Refresh all materialized views

## ENEM 2025 Data Import

When INEP releases 2025 data (expected July 2025):

```bash
# 1. Download from INEP portal
# https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados

# 2. Run import script
cd enem-analytics/backend
python scripts/import_enem_year.py --year 2025 --file /path/to/enem_2025.csv

# 3. Verify import
python scripts/import_enem_year.py --year 2025 --file /path/to/data.csv --dry-run
```

## RLS Policies Summary

### profiles
- `profiles_select_policy` - Users see own, admins see all
- `profiles_update_policy` - Users update own, admins update all
- `profiles_insert_policy` - Admins only
- `profiles_delete_policy` - Admins only

### school_skills / enem_results / schools
- `*_public_read` - Public read access
- `*_admin_modify` - Admins can modify

## Performance Notes

1. **Materialized Views**: Refresh after bulk data imports
   ```sql
   SELECT refresh_materialized_views();
   ```

2. **Indexes**: All commonly queried columns are indexed

3. **RLS**: Consolidated policies to avoid multiple permissive policy overhead

## Backup Before Migration

Always backup before running migrations:

```sql
-- Export current data
COPY public.profiles TO '/tmp/profiles_backup.csv' WITH CSV HEADER;
COPY public.school_skills TO '/tmp/school_skills_backup.csv' WITH CSV HEADER;
```

Or use Supabase Dashboard > Database > Backups.
