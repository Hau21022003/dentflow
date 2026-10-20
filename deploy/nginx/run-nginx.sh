#!/bin/sh
set -eu

bootstrap_template=/opt/dentflow/staging-bootstrap.conf.template
https_template=/opt/dentflow/staging-https.conf.template
active_config=/etc/nginx/conf.d/default.conf
reload_marker=/var/www/certbot/.nginx-reload

case "${STAGING_DOMAIN:-}" in
  ""|.*|*.|*[!A-Za-z0-9.-]*)
    echo "STAGING_DOMAIN is missing or invalid." >&2
    exit 1
    ;;
esac

certificate_file="/etc/letsencrypt/live/${STAGING_DOMAIN}/fullchain.pem"
private_key_file="/etc/letsencrypt/live/${STAGING_DOMAIN}/privkey.pem"

certificate_ready() {
  [ -s "$certificate_file" ] && [ -s "$private_key_file" ]
}

render_config() {
  template="$1"
  destination="$2"
  envsubst '${STAGING_DOMAIN}' < "$template" > "$destination"
}

activate_config() {
  template="$1"
  candidate="${active_config}.candidate"
  backup="${active_config}.backup"

  render_config "$template" "$candidate"
  if [ -f "$active_config" ]; then
    cp "$active_config" "$backup"
  else
    rm -f "$backup"
  fi
  mv "$candidate" "$active_config"

  if nginx -t; then
    rm -f "$backup"
    return 0
  fi

  echo "Rejected invalid Nginx configuration; restoring the previous file." >&2
  if [ -f "$backup" ]; then
    mv "$backup" "$active_config"
  else
    rm -f "$active_config"
  fi
  return 1
}

if certificate_ready; then
  mode=https
  render_config "$https_template" "$active_config"
else
  mode=bootstrap
  render_config "$bootstrap_template" "$active_config"
fi
nginx -t

watch_certificates() {
  last_marker=""
  [ -f "$reload_marker" ] && last_marker="$(cat "$reload_marker" 2>/dev/null || true)"

  while sleep 5; do
    if [ "$mode" = bootstrap ] && certificate_ready; then
      if activate_config "$https_template"; then
        nginx -s reload
        mode=https
        [ -f "$reload_marker" ] && last_marker="$(cat "$reload_marker" 2>/dev/null || true)"
        echo "TLS certificate detected; HTTPS configuration activated."
      fi
      continue
    fi

    if [ "$mode" = https ] && [ -f "$reload_marker" ]; then
      current_marker="$(cat "$reload_marker" 2>/dev/null || true)"
      if [ "$current_marker" != "$last_marker" ]; then
        nginx -t
        nginx -s reload
        last_marker="$current_marker"
        echo "Nginx reloaded after certificate renewal."
      fi
    fi
  done
}

watch_certificates &
exec nginx -g 'daemon off;'
