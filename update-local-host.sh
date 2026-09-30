#!/bin/sh
# Re-point local.pixapos.store at this Mac's current Wi-Fi IP.
# Usage: ./update-local-host.sh   (prompts for your password via sudo)
set -eu

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "Could not determine Wi-Fi IP (en0/en1). Is Wi-Fi connected?" >&2
  exit 1
fi

if grep -q "local.pixapos.store" /etc/hosts; then
  sudo sed -i '' "s/^.* local\.pixapos\.store\$/${IP} local.pixapos.store/" /etc/hosts
else
  echo "${IP} local.pixapos.store" | sudo tee -a /etc/hosts >/dev/null
fi

grep pixapos /etc/hosts
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
echo "local.pixapos.store -> ${IP}"
