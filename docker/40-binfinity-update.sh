#!/bin/sh
# Enables the in-app update button when a Watchtower helper is configured.
# UPDATE_TOKEN must match WATCHTOWER_HTTP_API_TOKEN of the helper container.
set -eu

if [ -z "${UPDATE_TOKEN:-}" ]; then
    exit 0
fi

UPDATE_URL="${UPDATE_URL:-http://binfinity-updater:8080/v1/update}"

cat > /etc/nginx/conf.d/update.inc <<CONF
limit_except POST { deny all; }
# Docker's embedded DNS; resolving at request time lets nginx start even
# when the helper container is not up yet.
resolver 127.0.0.11 valid=30s ipv6=off;
set \$binfinity_updater "$UPDATE_URL";
proxy_set_header Authorization "Bearer $UPDATE_TOKEN";
proxy_read_timeout 300s;
proxy_pass \$binfinity_updater;
CONF

sed -i 's/"selfUpdate":false/"selfUpdate":true/' /usr/share/nginx/html/config.json
echo "binfinity: self-update enabled via $UPDATE_URL"
