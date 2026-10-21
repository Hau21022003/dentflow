#!/usr/bin/env bash
set -euo pipefail

project_name=dentflow-staging
application_services=(postgres redis backend frontend)
database_volumes=(
  dentflow-staging_postgres_data
  dentflow-staging_redis_data
)

container_for_service() {
  local service="$1"
  local matches=()
  mapfile -t matches < <(docker ps -aq \
    --filter "label=com.docker.compose.project=$project_name" \
    --filter "label=com.docker.compose.service=$service")
  if [[ "${#matches[@]}" -ne 1 ]]; then
    echo "Expected exactly one $service container; found ${#matches[@]}." >&2
    return 1
  fi
  printf '%s\n' "${matches[0]}"
}

application_snapshot() {
  local service container_id
  for service in "${application_services[@]}"; do
    container_id="$(container_for_service "$service")"
    docker inspect --format \
      "$service|{{.Id}}|{{.Config.Image}}|{{.RestartCount}}|{{.State.OOMKilled}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" \
      "$container_id"
  done
}

volume_snapshot() {
  local volume
  for volume in "${database_volumes[@]}"; do
    docker volume inspect --format \
      '{{.Name}}|{{.Driver}}|{{.Mountpoint}}|{{json .Options}}' "$volume"
  done
}

resource_gate() {
  local since="${1:-24 hours ago}"
  local mem_available_kib swap_total_kib disk_available_kib disk_used_percent
  local service container_id health oom restarts oom_log

  mem_available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  swap_total_kib="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)"
  read -r disk_available_kib disk_used_percent < <(
    df -Pk / | awk 'NR == 2 {gsub(/%/, "", $5); print $4, $5}'
  )

  (( mem_available_kib >= 204800 )) || {
    echo "Resource gate failed: MemAvailable is below 200 MiB." >&2
    return 1
  }
  (( swap_total_kib >= 1040000 )) || {
    echo "Resource gate failed: active swap is below approximately 1 GiB." >&2
    return 1
  }
  (( disk_available_kib >= 5242880 )) || {
    echo "Resource gate failed: root filesystem has less than 5 GiB free." >&2
    return 1
  }
  (( disk_used_percent <= 80 )) || {
    echo "Resource gate failed: root filesystem is more than 80% used." >&2
    return 1
  }

  for service in "${application_services[@]}"; do
    container_id="$(container_for_service "$service")"
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
    oom="$(docker inspect --format '{{.State.OOMKilled}}' "$container_id")"
    restarts="$(docker inspect --format '{{.RestartCount}}' "$container_id")"
    [[ "$health" == healthy ]] || {
      echo "Resource gate failed: $service health is $health." >&2
      return 1
    }
    [[ "$oom" == false ]] || {
      echo "Resource gate failed: $service has OOMKilled=true." >&2
      return 1
    }
    echo "$service: healthy, restart_count=$restarts, OOMKilled=$oom"
  done

  sudo -n true >/dev/null 2>&1 || {
    echo "Resource gate failed: passwordless sudo is required to inspect kernel OOM logs." >&2
    return 1
  }
  oom_log="$(sudo -n journalctl -k --since "$since" --no-pager 2>/dev/null \
    | grep -Eai 'out of memory|oom-kill|killed process' || true)"
  [[ -z "$oom_log" ]] || {
    echo "Resource gate failed: kernel OOM activity was detected since $since." >&2
    return 1
  }

  printf 'MemAvailable=%sMiB SwapTotal=%sMiB RootFree=%sMiB RootUsed=%s%%\n' \
    "$((mem_available_kib / 1024))" \
    "$((swap_total_kib / 1024))" \
    "$((disk_available_kib / 1024))" \
    "$disk_used_percent"
  docker stats --no-stream --format \
    '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}'
  docker system df
}

edge_smoke() {
  local domain="${1:?domain is required}"
  local nginx_id certbot_id redirect

  nginx_id="$(container_for_service nginx)"
  certbot_id="$(container_for_service certbot)"
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$nginx_id")" == healthy ]]
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$certbot_id")" == healthy ]]
  [[ "$(docker inspect --format '{{.State.OOMKilled}}' "$nginx_id")" == false ]]
  [[ "$(docker inspect --format '{{.State.OOMKilled}}' "$certbot_id")" == false ]]

  curl --fail --silent --show-error --max-time 10 \
    "http://$domain/nginx-health" >/dev/null
  redirect="$(curl --silent --show-error --max-time 10 \
    --output /dev/null --write-out '%{http_code}|%{redirect_url}' "http://$domain/")"
  [[ "$redirect" == "308|https://$domain/" ]]
  curl --fail --silent --show-error --max-time 10 \
    "https://$domain/nginx-health" >/dev/null
  curl --fail --silent --show-error --max-time 10 \
    "https://$domain/" >/dev/null
  curl --fail --silent --show-error --max-time 10 \
    "https://$domain/api/" >/dev/null

  echo "Edge smoke passed: HTTP redirect, HTTPS frontend, and HTTPS API health."
}

case "${1:-}" in
  application-snapshot)
    application_snapshot
    ;;
  volume-snapshot)
    volume_snapshot
    ;;
  resource-gate)
    resource_gate "${2:-24 hours ago}"
    ;;
  smoke)
    edge_smoke "${2:-}"
    ;;
  *)
    echo "Usage: $0 {application-snapshot|volume-snapshot|resource-gate [since]|smoke <domain>}" >&2
    exit 2
    ;;
esac
