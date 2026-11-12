#!/bin/sh
# Database dump plus an uploads archive, pruned after BACKUP_KEEP_DAYS days.
# Run nightly by the `backup` service in docker-compose.prod.yml; restore steps are in docs/deployment.md.
set -eu

dir=/backups
stamp=$(date -u +%Y%m%d-%H%M%S)
keep="${BACKUP_KEEP_DAYS:-14}"

# Write to a temporary name first so a half-written file never looks like a good backup.
pg_dump --format=custom --file="$dir/db-$stamp.dump.partial"
mv "$dir/db-$stamp.dump.partial" "$dir/db-$stamp.dump"

tar -czf "$dir/uploads-$stamp.tar.gz.partial" -C /data uploads
mv "$dir/uploads-$stamp.tar.gz.partial" "$dir/uploads-$stamp.tar.gz"

find "$dir" \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$keep" -delete
find "$dir" -name '*.partial' -mtime +1 -delete

echo "$(date -u +%FT%TZ) backup: wrote db-$stamp.dump ($(du -h "$dir/db-$stamp.dump" | cut -f1)) and uploads-$stamp.tar.gz"
