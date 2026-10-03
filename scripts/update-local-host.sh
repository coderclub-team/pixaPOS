
#!/usr/bin/env bash

set -Eeuo pipefail

echo "======================================"
echo "pixaPOS Local DNS Setup"
echo "======================================"
echo ""

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

DOMAIN="local.pixapos.store"
DNSMASQ_DIR="/usr/local/etc/dnsmasq.d"
DNSMASQ_CONF="${DNSMASQ_DIR}/pixapos.conf"

# ---------------------------------------------------------
# Sudo
# ---------------------------------------------------------

if [[ "$EUID" -eq 0 ]]; then
    SUDO=""
else
    SUDO="sudo"
fi

# ---------------------------------------------------------
# Detect active network interface
# ---------------------------------------------------------

echo "Detecting active network interface..."

INTERFACE=$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}')

if [[ -z "$INTERFACE" ]]; then
    echo "ERROR: Could not detect active network interface."
    exit 1
fi

echo "Network interface: $INTERFACE"

# ---------------------------------------------------------
# Detect current LAN IP
# ---------------------------------------------------------

LOCAL_IP=$(ipconfig getifaddr "$INTERFACE" 2>/dev/null || true)

if [[ -z "$LOCAL_IP" ]]; then
    echo "ERROR: Could not determine local IP."
    exit 1
fi

echo "Local IP: $LOCAL_IP"

# ---------------------------------------------------------
# Locate dnsmasq
# ---------------------------------------------------------

DNSMASQ_BIN=""

if [[ -x "/usr/local/sbin/dnsmasq" ]]; then
    DNSMASQ_BIN="/usr/local/sbin/dnsmasq"
elif [[ -x "/usr/local/bin/dnsmasq" ]]; then
    DNSMASQ_BIN="/usr/local/bin/dnsmasq"
elif command -v dnsmasq >/dev/null 2>&1; then
    DNSMASQ_BIN="$(command -v dnsmasq)"
fi

if [[ -z "$DNSMASQ_BIN" ]]; then
    echo ""
    echo "ERROR: Could not find the dnsmasq executable."
    echo ""
    echo "But your Homebrew dnsmasq service appears to exist."
    echo "Run:"
    echo ""
    echo "  brew --prefix dnsmasq"
    echo ""
    echo "  brew list dnsmasq"
    echo ""
    exit 1
fi

echo "dnsmasq: $DNSMASQ_BIN"

# ---------------------------------------------------------
# Create dnsmasq directory
# ---------------------------------------------------------

echo ""
echo "Updating dnsmasq configuration..."

$SUDO mkdir -p "$DNSMASQ_DIR"

# ---------------------------------------------------------
# Write dnsmasq configuration
# ---------------------------------------------------------

$SUDO tee "$DNSMASQ_CONF" >/dev/null <<EOF
# pixaPOS local development

# Resolve local.pixapos.store and all subdomains
# to this Mac's current LAN IP.
address=/${DOMAIN}/${LOCAL_IP}

# Accept DNS requests from:
# - this Mac
# - devices on the same Wi-Fi/LAN
listen-address=127.0.0.1,${LOCAL_IP}

bind-interfaces
EOF

echo ""
echo "dnsmasq configuration:"
echo "--------------------------------------"
$SUDO cat "$DNSMASQ_CONF"
echo "--------------------------------------"

# ---------------------------------------------------------
# Validate dnsmasq
# ---------------------------------------------------------

echo ""
echo "Validating dnsmasq configuration..."

if $SUDO "$DNSMASQ_BIN" --test; then
    echo "dnsmasq configuration: OK"
else
    echo "ERROR: dnsmasq configuration is invalid."
    exit 1
fi

# ---------------------------------------------------------
# Restart dnsmasq
# ---------------------------------------------------------

echo ""
echo "Restarting dnsmasq..."

$SUDO brew services restart dnsmasq

sleep 2

# ---------------------------------------------------------
# Flush macOS DNS cache
# ---------------------------------------------------------

echo ""
echo "Flushing macOS DNS cache..."

$SUDO dscacheutil -flushcache
$SUDO killall -HUP mDNSResponder 2>/dev/null || true

sleep 1

# ---------------------------------------------------------
# Test localhost DNS
# ---------------------------------------------------------

echo ""
echo "Testing DNS through localhost..."

LOCAL_RESULT=$(dig +short "$DOMAIN" @127.0.0.1 2>/dev/null || true)

if echo "$LOCAL_RESULT" | grep -qx "$LOCAL_IP"; then
    echo "OK: $DOMAIN -> $LOCAL_IP"
else
    echo "WARNING: localhost DNS returned:"
    echo "$LOCAL_RESULT"
fi

# ---------------------------------------------------------
# Test LAN DNS
# ---------------------------------------------------------

echo ""
echo "Testing DNS through LAN IP..."

LAN_RESULT=$(dig +short "$DOMAIN" @"$LOCAL_IP" 2>/dev/null || true)

if echo "$LAN_RESULT" | grep -qx "$LOCAL_IP"; then
    echo "OK: LAN DNS -> $LOCAL_IP"
else
    echo "WARNING: LAN DNS returned:"
    echo "$LAN_RESULT"
fi

# ---------------------------------------------------------
# Check dnsmasq UDP 53
# ---------------------------------------------------------

echo ""
echo "Checking dnsmasq DNS listener..."

if $SUDO lsof -nP -iUDP:53 2>/dev/null | grep -q dnsmasq; then
    echo "OK: dnsmasq is listening on UDP port 53."
else
    echo "WARNING: dnsmasq is not detected on UDP port 53."
fi

# ---------------------------------------------------------
# Check HTTPS port 443
# ---------------------------------------------------------

echo ""
echo "Checking HTTPS server on port 443..."

if $SUDO lsof -nP -iTCP:443 -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
    echo "OK: HTTPS server is listening on port 443."
else
    echo "WARNING: Nothing is listening on port 443."
fi

# ---------------------------------------------------------
# Final output
# ---------------------------------------------------------

echo ""
echo "======================================"
echo "pixaPOS Local DNS Ready"
echo "======================================"
echo ""
echo "Mac LAN IP:"
echo "  $LOCAL_IP"
echo ""
echo "DNS:"
echo "  $DOMAIN -> $LOCAL_IP"
echo "  *.${DOMAIN} -> $LOCAL_IP"
echo ""
echo "URLs:"
echo "  https://local.pixapos.store/"
echo "  https://pos.local.pixapos.store/"
echo "  https://kds.local.pixapos.store/"
echo ""
echo "Phone / Tablet DNS:"
echo "  $LOCAL_IP"
echo ""
echo "======================================"
