#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

fail() {
  printf 'Install failed: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: sudo ./install.sh --credentials /root-or-run/backup.env

The credentials input must be a root:root regular file with mode 0400 or 0600.
This installer validates AWS access and installs the script and systemd units,
but never starts a backup or enables the timer.
EOF
  exit 2
}

if [[ $- == *x* ]]; then
  set +x
  fail 'do not run this installer with shell tracing enabled'
fi

credentials_file=
while (($#)); do
  case "$1" in
    --credentials)
      (($# >= 2)) || usage
      credentials_file=$2
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

[[ $EUID -eq 0 ]] || fail 'run as root via sudo'
[[ -n "$credentials_file" ]] || usage
[[ -f "$credentials_file" && ! -L "$credentials_file" ]] || \
  fail 'credentials input must be a regular file, not a symlink'
[[ "$(stat -c '%U:%G' "$credentials_file")" == root:root ]] || \
  fail 'credentials input must be owned by root:root'
credentials_mode=$(stat -c '%a' "$credentials_file")
[[ "$credentials_mode" == 400 || "$credentials_mode" == 600 ]] || \
  fail 'credentials input mode must be 0400 or 0600'

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
backup_source="$script_dir/dentflow-postgres-backup.sh"
service_source="$script_dir/dentflow-postgres-backup.service"
timer_source="$script_dir/dentflow-postgres-backup.timer"
for source_file in "$backup_source" "$service_source" "$timer_source"; do
  [[ -f "$source_file" && ! -L "$source_file" ]] || \
    fail "missing deployment artifact: $source_file"
done
bash -n "$backup_source"

declare -A config=()
while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  raw_line=${raw_line%$'\r'}
  [[ -z "$raw_line" || "$raw_line" == \#* ]] && continue
  [[ "$raw_line" == *=* ]] || fail 'credentials input contains an invalid line'
  key=${raw_line%%=*}
  value=${raw_line#*=}
  case "$key" in
    AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_DEFAULT_REGION|AWS_REGION|\
    AWS_EC2_METADATA_DISABLED|BACKUP_S3_BUCKET|BACKUP_S3_PREFIX)
      ;;
    *)
      fail "credentials input contains unsupported key: $key"
      ;;
  esac
  [[ -z "${config[$key]+present}" ]] || fail "credentials input repeats key: $key"
  [[ -n "$value" ]] || fail "credentials input has an empty value: $key"
  [[ "$value" != *[$' \t\r\n']* ]] || fail "credentials input has whitespace in: $key"
  config[$key]=$value
done < "$credentials_file"

required_keys=(
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_DEFAULT_REGION
  AWS_REGION
  AWS_EC2_METADATA_DISABLED
  BACKUP_S3_BUCKET
  BACKUP_S3_PREFIX
)
for key in "${required_keys[@]}"; do
  [[ -n "${config[$key]:-}" ]] || fail "credentials input is missing: $key"
done

[[ "${config[AWS_ACCESS_KEY_ID]}" =~ ^[A-Z0-9]{16,32}$ ]] || \
  fail 'AWS access key ID has an invalid format'
[[ "${config[AWS_SECRET_ACCESS_KEY]}" =~ ^[A-Za-z0-9/+=]{32,128}$ ]] || \
  fail 'AWS secret access key has an invalid format'
[[ "${config[AWS_DEFAULT_REGION]}" == ap-southeast-1 ]] || \
  fail 'AWS_DEFAULT_REGION must be ap-southeast-1'
[[ "${config[AWS_REGION]}" == "${config[AWS_DEFAULT_REGION]}" ]] || \
  fail 'AWS_REGION and AWS_DEFAULT_REGION must match'
[[ "${config[AWS_EC2_METADATA_DISABLED]}" == true ]] || \
  fail 'AWS_EC2_METADATA_DISABLED must be true for this static-credential setup'
[[ "${config[BACKUP_S3_BUCKET]}" == dentflow-staging-pg-backups ]] || \
  fail 'unexpected staging backup bucket'
[[ "${config[BACKUP_S3_PREFIX]}" == postgresql/staging ]] || \
  fail 'unexpected staging backup prefix'

for dependency in aws docker flock sha256sum systemctl systemd-analyze; do
  command -v "$dependency" >/dev/null || fail "missing dependency: $dependency"
done
docker image inspect postgres:16-alpine >/dev/null 2>&1 || \
  fail 'postgres:16-alpine must already exist locally; the installer never pulls images'
mapfile -t postgres_ids < <(docker ps \
  --filter 'label=com.docker.compose.project=dentflow-staging' \
  --filter 'label=com.docker.compose.service=postgres' -q)
[[ ${#postgres_ids[@]} -eq 1 ]] || fail 'expected exactly one running staging PostgreSQL container'
[[ "$(docker exec "${postgres_ids[0]}" pg_dump --version)" == *' 16.'* ]] || \
  fail 'the running staging container does not provide pg_dump 16'

systemctl is-active --quiet dentflow-postgres-backup.service && \
  fail 'backup service is currently running'
timer_enabled=$(systemctl is-enabled dentflow-postgres-backup.timer 2>/dev/null || true)
timer_active=$(systemctl is-active dentflow-postgres-backup.timer 2>/dev/null || true)
[[ "$timer_enabled" != enabled && "$timer_active" != active ]] || \
  fail 'disable and stop the existing timer before installing an update'

export AWS_ACCESS_KEY_ID=${config[AWS_ACCESS_KEY_ID]}
export AWS_SECRET_ACCESS_KEY=${config[AWS_SECRET_ACCESS_KEY]}
export AWS_DEFAULT_REGION=${config[AWS_DEFAULT_REGION]}
export AWS_REGION=${config[AWS_REGION]}
export AWS_EC2_METADATA_DISABLED=${config[AWS_EC2_METADATA_DISABLED]}

principal_arn=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null) || \
  fail 'AWS credentials failed STS validation'
[[ "$principal_arn" == *':user/dentflow-staging-backup' ]] || \
  fail 'AWS credentials do not belong to dentflow-staging-backup'
bucket_region=$(aws s3api get-bucket-location \
  --bucket "${config[BACKUP_S3_BUCKET]}" \
  --query LocationConstraint --output text 2>/dev/null) || \
  fail 'cannot read backup bucket location'
[[ "$bucket_region" == "${config[AWS_DEFAULT_REGION]}" ]] || \
  fail 'backup bucket is in an unexpected region'
aws s3api list-objects-v2 \
  --bucket "${config[BACKUP_S3_BUCKET]}" \
  --prefix "${config[BACKUP_S3_PREFIX]}/" \
  --max-keys 1 >/dev/null 2>&1 || fail 'cannot list the approved backup prefix'
if aws s3api list-objects-v2 \
  --bucket "${config[BACKUP_S3_BUCKET]}" --max-keys 1 >/dev/null 2>&1; then
  fail 'backup principal can list the bucket root; expected prefix-scoped access'
fi
if aws s3api list-buckets >/dev/null 2>&1; then
  fail 'backup principal can list all buckets'
fi
if aws iam get-user --user-name dentflow-staging-backup >/dev/null 2>&1; then
  fail 'backup principal unexpectedly has IAM read permission'
fi
permission_probe="${config[BACKUP_S3_PREFIX]}/permission-probe-$(cat /proc/sys/kernel/random/uuid)"
if aws s3api delete-object \
  --bucket "${config[BACKUP_S3_BUCKET]}" --key "$permission_probe" >/dev/null 2>&1; then
  fail 'backup principal unexpectedly has DeleteObject permission'
fi

mkdir -p /etc/dentflow
config_tmp=$(mktemp /etc/dentflow/backup.env.XXXXXX)
cleanup() {
  unset config
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION AWS_REGION
  unset AWS_EC2_METADATA_DISABLED principal_arn
  if [[ -n "${config_tmp:-}" && -e "$config_tmp" ]]; then
    rm -f -- "$config_tmp"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
{
  printf 'AWS_ACCESS_KEY_ID=%s\n' "${config[AWS_ACCESS_KEY_ID]}"
  printf 'AWS_SECRET_ACCESS_KEY=%s\n' "${config[AWS_SECRET_ACCESS_KEY]}"
  printf 'AWS_DEFAULT_REGION=%s\n' "${config[AWS_DEFAULT_REGION]}"
  printf 'AWS_REGION=%s\n' "${config[AWS_REGION]}"
  printf 'AWS_EC2_METADATA_DISABLED=%s\n' "${config[AWS_EC2_METADATA_DISABLED]}"
  printf 'BACKUP_S3_BUCKET=%s\n' "${config[BACKUP_S3_BUCKET]}"
  printf 'BACKUP_S3_PREFIX=%s\n' "${config[BACKUP_S3_PREFIX]}"
} > "$config_tmp"
chown root:root "$config_tmp"
chmod 0600 "$config_tmp"
mv -f -- "$config_tmp" /etc/dentflow/backup.env
config_tmp=

install -o root -g root -m 0750 \
  "$backup_source" /usr/local/sbin/dentflow-postgres-backup
install -o root -g root -m 0644 \
  "$service_source" /etc/systemd/system/dentflow-postgres-backup.service
install -o root -g root -m 0644 \
  "$timer_source" /etc/systemd/system/dentflow-postgres-backup.timer

systemd-analyze verify \
  /etc/systemd/system/dentflow-postgres-backup.service \
  /etc/systemd/system/dentflow-postgres-backup.timer
systemctl daemon-reload

[[ "$(stat -c '%U:%G %a' /etc/dentflow/backup.env)" == 'root:root 600' ]] || \
  fail 'installed backup.env ownership or mode is incorrect'
[[ "$(stat -c '%U:%G %a' /usr/local/sbin/dentflow-postgres-backup)" == 'root:root 750' ]] || \
  fail 'installed backup script ownership or mode is incorrect'

printf '%s\n' \
  'Backup automation installed with the timer disabled.' \
  'Run verify.sh --enable-timer only after reviewing the manual-backup gate.'
