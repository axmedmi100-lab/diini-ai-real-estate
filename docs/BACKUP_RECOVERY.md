# DIINI backup and recovery

The production scheduler creates one AES-256-GCM encrypted application-data backup per UTC day in `/opt/diini-ai-platform/real-estate/backups`. Files older than 14 days are removed automatically.

Keep `BACKUP_ENCRYPTION_KEY` outside the backup directory. Losing this key makes every backup unrecoverable. Anyone with both the file and key can read customer data.

## Verify a backup

```bash
cd /opt/diini-ai-platform/real-estate
BACKUP_ENCRYPTION_KEY='the-production-key' node scripts/inspect-backup.mjs backups/diini-backup-YYYY-MM-DD.bin
```

The command authenticates the encrypted file and prints its manifest and record counts. Add `--extract` only during a controlled recovery; the decrypted JSON contains sensitive customer data and is written with owner-only permissions.

## Recovery sequence

1. Put the application in maintenance mode and preserve the damaged database before changing it.
2. Restore the latest provider-managed Supabase database backup first when available because it preserves PostgreSQL schema, constraints, Auth internals and transaction consistency.
3. Use the encrypted DIINI JSON backup to verify counts or recover application rows missing after the provider restore.
4. Restore parent tables before child tables. Do not blindly import Auth metadata into `auth.users`; use Supabase-supported Auth recovery procedures.
5. Run integrity checks, login tests, tenant-isolation tests and worker health checks before reopening production.

This repository intentionally does not include an automatic destructive restore command. Recovery must be reviewed and executed against a new or isolated database first.

