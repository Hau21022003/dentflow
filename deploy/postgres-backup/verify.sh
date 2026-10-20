#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

fail() {
  printf 'Verification failed: %s\n' "$1" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: sudo ./verify.sh [--domain staging.example.com] [--enable-timer]

Runs one real backup and all postflight checks. The timer is enabled only when
--enable-timer is supplied and every verification step passes.
EOF
  exit 2
}

domain=staging.lephuchau.online
enable_timer=false
while (($#)); do
  case "$1" in
    --domain)
      (($# >= 2)) || usage
      domain=$2
      shift 2
      ;;
    --enable-timer)
      enable_timer=true
      shift
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
case "$domain" in
  ''|.*|*.|*[!A-Za-z0-9.-]*) fail 'invalid staging domain' ;;
esac

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
edge_check=$(cd "$script_dir/.." && pwd)/scripts/check-staging-edge.sh
[[ -f "$edge_check" ]] || fail "missing shared staging checker: $edge_check"
[[ -x /usr/local/sbin/dentflow-postgres-backup ]] || fail 'backup script is not installed'
[[ "$(stat -c '%U:%G %a' /etc/dentflow/backup.env)" == 'root:root 600' ]] || \
  fail 'backup.env ownership or mode is incorrect'
systemd-analyze verify \
  /etc/systemd/system/dentflow-postgres-backup.service \
  /etc/systemd/system/dentflow-postgres-backup.timer

stack_snapshot() {
  local id
  while IFS= read -r id; do
    docker inspect --format \
      '{{index .Config.Labels "com.docker.compose.service"}}|{{.Id}}|{{.Config.Image}}|{{.RestartCount}}|{{.State.OOMKilled}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
      "$id"
  done < <(docker ps -aq --filter 'label=com.docker.compose.project=dentflow-staging') \
    | sort
}

if [[ "$enable_timer" == true ]]; then
  timer_enabled=$(systemctl is-enabled dentflow-postgres-backup.timer 2>/dev/null || true)
  timer_active=$(systemctl is-active dentflow-postgres-backup.timer 2>/dev/null || true)
  [[ "$timer_enabled" != enabled && "$timer_active" != active ]] || \
    fail 'the timer must be disabled and inactive before the first acceptance run'
fi

printf '%s\n' 'Running pre-backup resource and identity gates.'
pre_stack=$(stack_snapshot)
[[ "$(printf '%s\n' "$pre_stack" | sed '/^$/d' | wc -l)" -eq 6 ]] || \
  fail 'expected exactly six staging containers before backup'
while IFS='|' read -r service _id _image restarts oom state health; do
  [[ "$state" == running && "$health" == healthy ]] || \
    fail "container is not healthy before backup: $service"
  [[ "$restarts" == 0 && "$oom" == false ]] || \
    fail "container restart/OOM invariant failed before backup: $service"
done <<< "$pre_stack"
pre_volumes=$(bash "$edge_check" volume-snapshot)
bash "$edge_check" resource-gate '24 hours ago'
bash "$edge_check" smoke "$domain"

started_at=$(date -u +'%Y-%m-%d %H:%M:%S')
printf 'Starting one manual backup at %s UTC.\n' "$started_at"
if ! systemctl start dentflow-postgres-backup.service; then
  journalctl -u dentflow-postgres-backup.service --since "$started_at" --no-pager
  fail 'manual backup service failed'
fi

[[ "$(systemctl show dentflow-postgres-backup.service -p Result --value)" == success ]] || \
  fail 'manual backup service result is not success'
[[ "$(systemctl show dentflow-postgres-backup.service -p ExecMainStatus --value)" == 0 ]] || \
  fail 'manual backup service exit status is non-zero'
pass_line=$(journalctl -u dentflow-postgres-backup.service \
  --since "$started_at" --no-pager -o cat | grep 'status=PASS' | tail -n 1)
[[ -n "$pass_line" ]] || fail 'manual backup journal has no PASS record'

temp_count=$(find /run -maxdepth 1 -type d \
  -name 'dentflow-postgres-backup.*' -print | wc -l)
[[ "$temp_count" -eq 0 ]] || fail 'backup temporary directory was not cleaned up'

post_stack=$(stack_snapshot)
post_volumes=$(bash "$edge_check" volume-snapshot)
[[ "$post_stack" == "$pre_stack" ]] || \
  fail 'staging container identity/state changed during backup'
[[ "$post_volumes" == "$pre_volumes" ]] || \
  fail 'database volume identity changed during backup'
bash "$edge_check" resource-gate "$started_at"
bash "$edge_check" smoke "$domain"

if [[ "$enable_timer" == true ]]; then
  systemctl enable --now dentflow-postgres-backup.timer
  [[ "$(systemctl is-enabled dentflow-postgres-backup.timer)" == enabled ]] || \
    fail 'timer did not become enabled'
  [[ "$(systemctl is-active dentflow-postgres-backup.timer)" == active ]] || \
    fail 'timer did not become active'
  printf 'Timer enabled; next run: %s\n' \
    "$(systemctl show dentflow-postgres-backup.timer -p NextElapseUSecRealtime --value)"
else
  printf '%s\n' 'Timer was not enabled; rerun with --enable-timer after reviewing this PASS.'
fi

printf '%s\n' \
  'Manual backup PASS: S3 upload, SSE-S3, SHA-256, pg_restore --list, health, and identity gates passed.'
