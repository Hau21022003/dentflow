#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}
export PATH

readonly POSTGRES_IMAGE=postgres:16-alpine
readonly RESTORE_DATABASE=dentflow_phase3d
readonly RESTORE_USER=dentflow_phase3d
container_name=

fail() {
  printf 'Restore drill failed: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: ./restore-drill.sh --dump /path/backup.dump --checksum /path/backup.dump.sha256

Restores one verified DentFlow staging backup into a disposable PostgreSQL 16
container with no network and no published ports. The restored database lives
only on tmpfs and the container is removed when the drill finishes or fails.
EOF
  exit 2
}

cleanup() {
  local rc=$?
  trap - EXIT
  if [[ -n "${container_name:-}" ]]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

dump_file=
checksum_file=
while (($#)); do
  case "$1" in
    --dump)
      (($# >= 2)) || usage
      dump_file=$2
      shift 2
      ;;
    --checksum)
      (($# >= 2)) || usage
      checksum_file=$2
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      usage
      ;;
  esac
done

[[ -n "$dump_file" && -n "$checksum_file" ]] || usage
[[ -f "$dump_file" && ! -L "$dump_file" ]] || \
  fail 'dump must be a regular file, not a symlink'
[[ -f "$checksum_file" && ! -L "$checksum_file" ]] || \
  fail 'checksum must be a regular file, not a symlink'
[[ -s "$dump_file" && -s "$checksum_file" ]] || fail 'input file is empty'

for marker in /sys/class/dmi/id/product_name /sys/class/dmi/id/sys_vendor; do
  if [[ -r "$marker" ]] && grep -Eqi 'amazon|ec2' "$marker"; then
    fail 'refusing to run the local restore drill on an EC2 host'
  fi
done

for dependency in docker sha256sum awk sed wc basename grep tr; do
  command -v "$dependency" >/dev/null || fail "missing dependency: $dependency"
done
docker info >/dev/null 2>&1 || fail 'Docker is not available'
docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 || \
  fail "$POSTGRES_IMAGE must already exist locally; the drill never pulls images"

dump_name=$(basename "$dump_file")
checksum_name=$(basename "$checksum_file")
[[ "$dump_name" == dentflow-staging-*.dump ]] || fail 'unexpected dump filename'
[[ "$checksum_name" == "${dump_name}.sha256" ]] || \
  fail 'checksum filename does not match the dump filename'

checksum_lines=$(wc -l < "$checksum_file" | tr -d '[:space:]')
[[ "$checksum_lines" == 1 ]] || fail 'checksum sidecar must contain exactly one line'
checksum_line=$(sed 's/\r$//' "$checksum_file")
expected_hash=${checksum_line%%[[:space:]]*}
listed_name=${checksum_line#*  }
[[ "$expected_hash" =~ ^[0-9a-f]{64}$ ]] || fail 'checksum sidecar has an invalid SHA-256'
[[ "$listed_name" == "$dump_name" ]] || fail 'checksum sidecar names a different dump'

actual_hash=$(sha256sum "$dump_file" | awk '{print $1}')
[[ "$actual_hash" == "$expected_hash" ]] || fail 'dump SHA-256 does not match its sidecar'
archive_bytes=$(wc -c < "$dump_file" | tr -d '[:space:]')
[[ "$archive_bytes" =~ ^[0-9]+$ ]] && ((archive_bytes > 0)) || \
  fail 'cannot determine archive size'

postgres_version=$(docker run --rm --network none "$POSTGRES_IMAGE" postgres --version)
[[ "$postgres_version" == *' 16.'* ]] || fail 'restore image is not PostgreSQL 16'
docker run --rm --network none --read-only \
  --security-opt no-new-privileges --cap-drop ALL \
  --memory 128m --cpus 0.5 -i "$POSTGRES_IMAGE" \
  pg_restore --list < "$dump_file" >/dev/null || fail 'pg_restore cannot read the archive'

container_name="dentflow-phase3d-$(date -u +'%Y%m%d%H%M%S')-${RANDOM}"
docker run --detach \
  --name "$container_name" \
  --network none \
  --memory 512m \
  --cpus 1 \
  --pids-limit 256 \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,nodev,size=512m \
  --env POSTGRES_DB="$RESTORE_DATABASE" \
  --env POSTGRES_USER="$RESTORE_USER" \
  --env POSTGRES_HOST_AUTH_METHOD=trust \
  "$POSTGRES_IMAGE" >/dev/null

[[ "$(docker inspect --format '{{.HostConfig.NetworkMode}}' "$container_name")" == none ]] || \
  fail 'restore container unexpectedly has network access'
[[ -z "$(docker port "$container_name")" ]] || \
  fail 'restore container unexpectedly publishes a host port'

ready=false
for ((_attempt = 1; _attempt <= 60; _attempt++)); do
  if docker exec "$container_name" \
    pg_isready --quiet --username "$RESTORE_USER" --dbname "$RESTORE_DATABASE"; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || fail 'disposable PostgreSQL did not become ready'

docker exec -i "$container_name" pg_restore \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-privileges \
  --username "$RESTORE_USER" \
  --dbname "$RESTORE_DATABASE" \
  < "$dump_file" || fail 'pg_restore failed'

psql_scalar() {
  docker exec "$container_name" psql \
    --username "$RESTORE_USER" \
    --dbname "$RESTORE_DATABASE" \
    --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "$1"
}

table_count=$(psql_scalar \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';")
[[ "$table_count" =~ ^[0-9]+$ ]] && ((table_count > 0)) || \
  fail 'restored database has no public tables'

expected_tables=$(psql_scalar \
  "SELECT count(*) FROM (VALUES ('users'), ('tenants'), ('branches'), ('patients'), ('appointments')) AS expected(name) WHERE to_regclass('public.' || name) IS NOT NULL;")
[[ "$expected_tables" == 5 ]] || fail 'restored database is missing a required core table'

migration_count=$(psql_scalar \
  "SELECT CASE WHEN to_regclass('public.migrations') IS NULL THEN 0 ELSE (SELECT count(*) FROM migrations) END;")
[[ "$migration_count" =~ ^[0-9]+$ ]] && ((migration_count > 0)) || \
  fail 'restored database has no migration history'

core_row_count=$(psql_scalar \
  'SELECT (SELECT count(*) FROM users) + (SELECT count(*) FROM tenants) + (SELECT count(*) FROM branches) + (SELECT count(*) FROM patients);')
[[ "$core_row_count" =~ ^[0-9]+$ ]] && ((core_row_count > 0)) || \
  fail 'restored database has no synthetic core data'

invalid_constraints=$(psql_scalar \
  "SELECT count(*) FROM pg_catalog.pg_constraint WHERE contype IN ('c', 'f') AND NOT convalidated;")
[[ "$invalid_constraints" == 0 ]] || fail 'restored database has unvalidated constraints'
invalid_indexes=$(psql_scalar \
  'SELECT count(*) FROM pg_catalog.pg_index WHERE NOT indisvalid;')
[[ "$invalid_indexes" == 0 ]] || fail 'restored database has invalid indexes'
database_bytes=$(psql_scalar 'SELECT pg_database_size(current_database());')
[[ "$database_bytes" =~ ^[0-9]+$ ]] && ((database_bytes > 0)) || \
  fail 'restored database size is invalid'

printf 'Phase 3D restore drill PASS: archive=%s archive_bytes=%s sha256=%s postgres_major=16 public_tables=%s migrations=%s core_rows=%s database_bytes=%s network=none published_ports=0 cleanup=armed\n' \
  "$dump_name" "$archive_bytes" "$actual_hash" "$table_count" \
  "$migration_count" "$core_row_count" "$database_bytes"
