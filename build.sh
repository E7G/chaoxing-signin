#!/bin/bash
set -e

# Build fnOS .fpk package locally
# Usage: ./build.sh [version] [platform]

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Read manifest
APPNAME=$(grep "^appname" manifest | awk -F'=' '{print $2}' | tr -d ' ')
VERSION="${1:-$(grep "^version" manifest | awk -F'=' '{print $2}' | tr -d ' ')}"
PLATFORM="${2:-$(grep "^platform" manifest | awk -F'=' '{print $2}' | tr -d ' ')}"

if [ -z "$APPNAME" ]; then
    error "Cannot read appname from manifest"
fi

[ -z "$PLATFORM" ] && PLATFORM="x86"

info "Building FPK: ${APPNAME} v${VERSION} (${PLATFORM})"

# Create temp build directory
BUILD_DIR=$(mktemp -d)
PKG_DIR="${BUILD_DIR}/package"
mkdir -p "${PKG_DIR}/cmd"

# Copy app.tgz
[ -f "app.tgz" ] || error "app.tgz not found"
cp app.tgz "${PKG_DIR}/"

# Copy cmd/*
for f in cmd/*; do
    case "$(basename "$f")" in
        *.md|*.MD) continue ;;
    esac
    cp "$f" "${PKG_DIR}/cmd/"
done

# Copy config/
cp -a config "${PKG_DIR}/"

# Copy wizard/ if exists
if [ -d "wizard" ]; then
    cp -a wizard "${PKG_DIR}/"
fi

# Copy icons
cp ICON*.PNG "${PKG_DIR}/" 2>/dev/null || true

# Copy ui/ if exists
if [ -d "app/ui" ]; then
    cp -a app/ui "${PKG_DIR}/"
fi

# Copy manifest
cp manifest "${PKG_DIR}/"

# Calculate checksum
CHECKSUM=$(md5sum "${PKG_DIR}/app.tgz" | cut -d' ' -f1)
sed -i "s/^checksum.*/checksum        = ${CHECKSUM}/" "${PKG_DIR}/manifest"

# Add fpk_version if not present
if ! grep -q "^fpk_version" "${PKG_DIR}/manifest"; then
    echo "fpk_version     = ${VERSION}" >> "${PKG_DIR}/manifest"
fi

# Create FPK package
FPK_NAME="${APPNAME}_${VERSION}_${PLATFORM}.fpk"
cd "${PKG_DIR}"
tar -czf "${OLDPWD}/${FPK_NAME}" *
cd "${OLDPWD}"

# Cleanup
rm -rf "$BUILD_DIR"

info "Built: ${FPK_NAME} ($(du -h "$FPK_NAME" | cut -f1))"
echo "Output: ${SCRIPT_DIR}/${FPK_NAME}"
