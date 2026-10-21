#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

readonly BACKUP_SCRIPT_VERSION=1
readonly LOCK_FILE=/run/lock/dentflow-postgres-backup.lock
readonly MIN_AVAILABLE_KIB=300000
readonly POSTGRES_IMAGE=postgres:16-alpine
stage=initialization
failure_logged=no
temp_dir=
source_hash_pid=
download_hash_pid=

log() {
  printf '%s dentflow-postgres-backup %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

fail() {
  failure_logged=yes
  log "status=FAIL stage=${stage} reason=$1"
  exit 1
}

cleanup() {
  local rc=$?
  trap - EXIT
  for pid in "${source_hash_pid:-}" "${download_hash_pid:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  if [[ -n "${temp_dir:-}" && -d "$temp_dir" ]]; then
    rm -f -- "$temp_dir/source.fifo" "$temp_dir/download.fifo" \
      "$temp_dir/source.sha256" "$temp_dir/download.sha256"
    rmdir -- "$temp_dir" 2>/dev/null || true
  fi
  if (( rc != 0 )) && [[ "$failure_logged" != yes ]]; then
    log "status=FAIL stage=${stage} exit_code=${rc}"
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

exec 9>"$LOCK_FILE"
flock -n 9 || fail another-backup-is-running

stage=configuration
: "${AWS_ACCESS_KEY_ID:?missing AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?missing AWS_SECRET_ACCESS_KEY}"
: "${AWS_DEFAULT_REGION:?missing AWS_DEFAULT_REGION}"
: "${AWS_REGION:?missing AWS_REGION}"
: "${BACKUP_S3_BUCKET:?missing BACKUP_S3_BUCKET}"
: "${BACKUP_S3_PREFIX:?missing BACKUP_S3_PREFIX}"
[[ "$AWS_DEFAULT_REGION" == ap-southeast-1 ]] || fail unexpected-aws-default-region
[[ "$AWS_REGION" == "$AWS_DEFAULT_REGION" ]] || fail inconsistent-aws-region
[[ "$BACKUP_S3_BUCKET" == dentflow-staging-pg-backups ]] || fail unexpected-backup-bucket
[[ "$BACKUP_S3_PREFIX" == postgresql/staging ]] || fail unexpected-backup-prefix

stage=resource-gate
mem_available_kib=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
[[ "$mem_available_kib" =~ ^[0-9]+$ ]] || fail cannot-read-available-memory
(( mem_available_kib >= MIN_AVAILABLE_KIB )) || fail insufficient-available-memory

mapfile -t postgres_ids < <(docker ps \
  --filter 'label=com.docker.compose.project=dentflow-staging' \
  --filter 'label=com.docker.compose.service=postgres' -q)
[[ ${#postgres_ids[@]} -eq 1 ]] || fail postgres-container-count-is-not-one
postgres_id=${postgres_ids[0]}
[[ "$(docker inspect --format '{{.State.Status}}' "$postgres_id")" == running ]] || fail postgres-not-running
[[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$postgres_id")" == healthy ]] || fail postgres-not-healthy

mapfile -t backend_ids < <(docker ps \
  --filter 'label=com.docker.compose.project=dentflow-staging' \
  --filter 'label=com.docker.compose.service=backend' -q)
[[ ${#backend_ids[@]} -eq 1 ]] || fail backend-container-count-is-not-one
app_sha=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "${backend_ids[0]}")
[[ "$app_sha" =~ ^[0-9a-f]{40}$ ]] || fail invalid-application-revision

db_bytes=$(docker exec "$postgres_id" sh -c \
  'exec psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align --command "SELECT pg_database_size(current_database());"')
[[ "$db_bytes" =~ ^[0-9]+$ ]] || fail cannot-read-database-size

stage=aws-preflight
principal_arn=$(aws sts get-caller-identity --query Arn --output text)
[[ "$principal_arn" == *':user/dentflow-staging-backup' ]] || fail unexpected-aws-principal
bucket_region=$(aws s3api get-bucket-location \
  --bucket "$BACKUP_S3_BUCKET" --query LocationConstraint --output text)
[[ "$bucket_region" == "$AWS_DEFAULT_REGION" ]] || fail bucket-region-mismatch

timestamp=$(date -u +'%Y%m%dT%H%M%SZ')
date_path=$(date -u +'%Y/%m/%d')
object_key="${BACKUP_S3_PREFIX}/${date_path}/dentflow-staging-${timestamp}-${app_sha}.dump"
checksum_key="${object_key}.sha256"

temp_dir=$(mktemp -d /run/dentflow-postgres-backup.XXXXXX)
chmod 700 "$temp_dir"

stage=dump-upload
mkfifo "$temp_dir/source.fifo"
sha256sum < "$temp_dir/source.fifo" | awk '{print $1}' > "$temp_dir/source.sha256" &
source_hash_pid=$!
set +e
docker exec "$postgres_id" sh -c '
  exec nice -n 10 pg_dump \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format=custom \
    --compress=zstd:3 \
    --no-owner \
    --no-privileges \
    --lock-wait-timeout=10s
' | tee "$temp_dir/source.fifo" | \
  aws s3 cp - "s3://${BACKUP_S3_BUCKET}/${object_key}" \
    --sse AES256 \
    --checksum-algorithm SHA256 \
    --only-show-errors \
    --no-progress
pipeline_status=("${PIPESTATUS[@]}")
wait "$source_hash_pid"
hash_status=$?
source_hash_pid=
set -e
[[ ${pipeline_status[0]} -eq 0 ]] || fail pg-dump-failed
[[ ${pipeline_status[1]} -eq 0 ]] || fail source-hash-stream-failed
[[ ${pipeline_status[2]} -eq 0 ]] || fail s3-upload-failed
[[ $hash_status -eq 0 ]] || fail source-hash-failed
source_hash=$(tr -d '[:space:]' < "$temp_dir/source.sha256")
[[ "$source_hash" =~ ^[0-9a-f]{64}$ ]] || fail invalid-source-sha256

stage=object-metadata
read -r object_size object_sse < <(aws s3api head-object \
  --bucket "$BACKUP_S3_BUCKET" \
  --key "$object_key" \
  --query '[ContentLength,ServerSideEncryption]' \
  --output text)
[[ "$object_size" =~ ^[0-9]+$ ]] || fail invalid-s3-object-size
(( object_size > 0 )) || fail empty-s3-object
[[ "$object_sse" == AES256 ]] || fail s3-object-not-sse-s3

stage=download-integrity
mkfifo "$temp_dir/download.fifo"
sha256sum < "$temp_dir/download.fifo" | awk '{print $1}' > "$temp_dir/download.sha256" &
download_hash_pid=$!
set +e
aws s3 cp "s3://${BACKUP_S3_BUCKET}/${object_key}" - \
    --checksum-mode ENABLED \
    --only-show-errors \
    --no-progress | \
  tee "$temp_dir/download.fifo" | \
  docker run --rm --pull never --network none --read-only \
    --security-opt no-new-privileges --cap-drop ALL \
    --memory 128m --cpus 0.5 -i "$POSTGRES_IMAGE" \
    pg_restore --list >/dev/null
verify_status=("${PIPESTATUS[@]}")
wait "$download_hash_pid"
download_hash_status=$?
download_hash_pid=
set -e
[[ ${verify_status[0]} -eq 0 ]] || fail s3-download-failed
[[ ${verify_status[1]} -eq 0 ]] || fail download-hash-stream-failed
[[ ${verify_status[2]} -eq 0 ]] || fail pg-restore-list-failed
[[ $download_hash_status -eq 0 ]] || fail download-hash-failed
download_hash=$(tr -d '[:space:]' < "$temp_dir/download.sha256")
[[ "$download_hash" == "$source_hash" ]] || fail sha256-mismatch

stage=checksum-sidecar
printf '%s  %s\n' "$source_hash" "$(basename "$object_key")" | \
  aws s3 cp - "s3://${BACKUP_S3_BUCKET}/${checksum_key}" \
    --sse AES256 \
    --content-type text/plain \
    --checksum-algorithm SHA256 \
    --only-show-errors \
    --no-progress
sidecar_sse=$(aws s3api head-object \
  --bucket "$BACKUP_S3_BUCKET" \
  --key "$checksum_key" \
  --query ServerSideEncryption \
  --output text)
[[ "$sidecar_sse" == AES256 ]] || fail checksum-sidecar-not-sse-s3

stage=complete
log "status=PASS version=${BACKUP_SCRIPT_VERSION} object=${object_key} bytes=${object_size} sha256=${source_hash} db_bytes=${db_bytes} mem_available_kib=${mem_available_kib}"
