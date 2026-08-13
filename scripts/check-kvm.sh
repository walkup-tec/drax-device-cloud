#!/usr/bin/env bash
# Checagem rápida de KVM para Redroid (rode no VPS).
set -euo pipefail
echo "=== /dev/kvm ==="
ls -l /dev/kvm 2>/dev/null || echo "AUSENTE"
echo "=== CPU virt flags ==="
egrep -c '(vmx|svm)' /proc/cpuinfo || true
echo "=== docker info ==="
docker info 2>/dev/null | egrep -i 'Server Version|Operating System|Runtimes' || true
echo "OK se /dev/kvm existe e flags > 0"
