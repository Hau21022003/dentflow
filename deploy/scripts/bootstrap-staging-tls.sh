#!/usr/bin/env bash
set -euo pipefail

domain="${1:-staging.lephuchau.online}"
app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${STAGING_ENV_FILE:-/etc/dentflow/staging.env}"

case "$domain" in
  ""|.*|*.|*[!A-Za-z0-9.-]*)
    echo "The staging domain is invalid." >&2
    exit 1
    ;;
esac

: "${DENTFLOW_IMAGE_TAG:?DENTFLOW_IMAGE_TAG must contain the current application SHA}"
[[ "$DENTFLOW_IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]
[[ -r "$env_file" ]] || {
  echo "Cannot read $env_file." >&2
  exit 1
}

cd "$app_dir"
compose=(
  docker compose
  --env-file "$env_file"
  -f docker-compose.staging.yml
  -f docker-compose.edge.yml
)

"${compose[@]}" config --quiet

# Fail if the public domain requested by the operator differs from the value
# injected into the edge services. No environment-file value is printed.
"${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
  -c 'test "$STAGING_DOMAIN" = "$1"' sh "$domain"

"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 nginx certbot

issued_certificate=false
if "${compose[@]}" exec -T nginx /bin/sh -c \
  'test -s "$1" && test -s "$2"' sh \
  "/etc/letsencrypt/live/$domain/fullchain.pem" \
  "/etc/letsencrypt/live/$domain/privkey.pem"; then
  echo "A persistent certificate already exists; bootstrap issuance is not repeated."
else
  token="dentflow-edge-$(date -u +%s)-$$"
  content="dentflow-acme-$token"

  cleanup_challenge() {
    "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
      -c 'rm -f "/var/www/certbot/.well-known/acme-challenge/$1"' sh "$token" \
      >/dev/null 2>&1 || true
  }
  trap cleanup_challenge EXIT

  "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
    -c 'set -eu; mkdir -p /var/www/certbot/.well-known/acme-challenge; umask 022; printf "%s" "$2" > "/var/www/certbot/.well-known/acme-challenge/$1"' \
    sh "$token" "$content"

  challenge_url="http://$domain/.well-known/acme-challenge/$token"
  challenge_response="$(curl --fail --silent --show-error \
    --retry 5 --retry-delay 2 --max-time 10 "$challenge_url")"
  [[ "$challenge_response" == "$content" ]] || {
    echo "The public ACME HTTP-01 challenge path did not return the expected content." >&2
    exit 1
  }

  # One explicit attempt only. A failure stops the deployment instead of
  # repeatedly hitting Let's Encrypt issuance limits.
  "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
    -c 'exec certbot certonly --webroot --webroot-path /var/www/certbot --cert-name "$STAGING_DOMAIN" --domain "$STAGING_DOMAIN" --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email --non-interactive --keep-until-expiring --deploy-hook "date -u +%s > /var/www/certbot/.nginx-reload"' sh

  "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
    -c 'date -u +%s > /var/www/certbot/.nginx-reload'
  issued_certificate=true
  cleanup_challenge
  trap - EXIT
fi

for _ in $(seq 1 24); do
  if curl --fail --silent --show-error --max-time 10 \
    "https://$domain/nginx-health" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done

if [[ "$issued_certificate" == true ]]; then
  # Validate the renewal path once after first issuance. Normal renewal is
  # handled by the long-running certbot service every twelve hours.
  "${compose[@]}" run --rm --no-deps --entrypoint /bin/sh certbot \
    -c 'exec certbot renew --cert-name "$STAGING_DOMAIN" --webroot --webroot-path /var/www/certbot --dry-run' sh
fi

"${compose[@]}" exec -T nginx nginx -t
curl --fail --silent --show-error --max-time 10 \
  "https://$domain/nginx-health" >/dev/null
echo "TLS bootstrap/verification passed for $domain."
