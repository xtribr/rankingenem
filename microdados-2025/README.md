# Microdados ENEM 2025

Pasta local de staging para arquivos reais do ENEM 2025.

Regras:

- Coloque aqui somente arquivos reais recebidos do INEP/XTRI.
- CSV, ZIP e relatorios gerados ficam ignorados pelo Git.
- Nao criar exemplos com dados educacionais ficticios.
- O fluxo seguro deve comecar por dry-run local:

```bash
cd ../enem-analytics/backend
python scripts/update_enem_year.py --year 2025 --input ../../microdados-2025/arquivo.csv --env local --dry-run
```

Para gravar no Supabase local, use `--apply` somente depois de revisar o relatorio.
