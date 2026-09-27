FROM alpine:3.21.3

ARG MINIO_RELEASE=RELEASE.2025-04-22T22-12-26Z
ARG MC_RELEASE=RELEASE.2025-04-16T18-13-26Z

# The legacy public MinIO images were removed from their registries. Keep the
# E2E environment on the existing, pinned versions, but obtain their official
# release binaries and verify the published SHA-256 checksums at build time.
RUN set -eux; \
    apk add --no-cache ca-certificates curl; \
    case "$(apk --print-arch)" in \
      x86_64) binary_arch=amd64 ;; \
      aarch64) binary_arch=arm64 ;; \
      ppc64le) binary_arch=ppc64le ;; \
      *) echo "Unsupported architecture: $(apk --print-arch)" >&2; exit 1 ;; \
    esac; \
    for binary in minio mc; do \
      if [ "$binary" = minio ]; then release="$MINIO_RELEASE"; else release="$MC_RELEASE"; fi; \
      filename="${binary}.linux-${binary_arch}.${release}"; \
      url="https://github.com/minio/${binary}/releases/download/${release}/${filename}"; \
      curl --fail --location --silent --show-error --output "/tmp/${filename}" "$url"; \
      curl --fail --location --silent --show-error --output "/tmp/${filename}.sha256sum" "${url}.sha256sum"; \
      expected_checksum="$(awk '{print $1}' "/tmp/${filename}.sha256sum")"; \
      printf '%s  %s\n' "$expected_checksum" "/tmp/${filename}" | sha256sum -c -; \
      install --mode=0755 "/tmp/${filename}" "/usr/local/bin/${binary}"; \
      rm "/tmp/${filename}" "/tmp/${filename}.sha256sum"; \
    done

ENTRYPOINT ["/usr/local/bin/minio"]
