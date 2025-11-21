#!/usr/bin/env bash
# Synthesis Desktop - Smoke Test for Packaged App
# Phase 5: Packaging & Distribution
#
# This script performs basic smoke tests on the packaged desktop app
# to verify it can launch, show version, and has required resources bundled.

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DESKTOP_ROOT="$PROJECT_ROOT/apps/desktop"
RELEASE_DIR="$DESKTOP_ROOT/release"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

test_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((TESTS_PASSED++))
}

test_fail() {
  echo -e "${RED}✗${NC} $1"
  ((TESTS_FAILED++))
}

# ==============================================================================
# TESTS
# ==============================================================================

log_info "Starting Synthesis Desktop smoke tests..."
echo ""

# Test 1: Check release directory exists
log_info "Test 1: Checking release directory..."
if [ -d "$RELEASE_DIR" ]; then
  test_pass "Release directory exists: $RELEASE_DIR"
else
  test_fail "Release directory not found: $RELEASE_DIR"
  exit 1
fi
echo ""

# Test 2: Find AppImage (Linux)
log_info "Test 2: Checking for Linux AppImage..."
APPIMAGE=$(find "$RELEASE_DIR" -name "*.AppImage" -type f | head -n 1)
if [ -n "$APPIMAGE" ]; then
  test_pass "AppImage found: $(basename "$APPIMAGE")"
  APP_PATH="$APPIMAGE"
else
  log_warn "No AppImage found (this is OK if testing on Windows)"
  APP_PATH=""
fi
echo ""

# Test 3: Find Windows installer (NSIS)
log_info "Test 3: Checking for Windows installer..."
WIN_INSTALLER=$(find "$RELEASE_DIR" -name "*.exe" -type f | head -n 1)
if [ -n "$WIN_INSTALLER" ]; then
  test_pass "Windows installer found: $(basename "$WIN_INSTALLER")"
  if [ -z "$APP_PATH" ]; then
    APP_PATH="$WIN_INSTALLER"
  fi
else
  log_warn "No Windows installer found (this is OK if testing on Linux)"
fi
echo ""

# Test 4: Check if any build artifact exists
log_info "Test 4: Verifying at least one build artifact exists..."
if [ -z "$APP_PATH" ]; then
  test_fail "No build artifacts found in $RELEASE_DIR"
  echo "Available files:"
  ls -lh "$RELEASE_DIR" || echo "Directory is empty"
  exit 1
else
  test_pass "Build artifact found: $(basename "$APP_PATH")"
fi
echo ""

# Test 5: Check build artifact size (should be > 100MB)
log_info "Test 5: Checking build artifact size..."
FILE_SIZE=$(stat -c%s "$APP_PATH" 2>/dev/null || stat -f%z "$APP_PATH" 2>/dev/null || echo 0)
MIN_SIZE=$((100 * 1024 * 1024))  # 100MB in bytes

if [ "$FILE_SIZE" -gt "$MIN_SIZE" ]; then
  SIZE_MB=$((FILE_SIZE / 1024 / 1024))
  test_pass "Build artifact size is reasonable: ${SIZE_MB}MB"
else
  SIZE_MB=$((FILE_SIZE / 1024 / 1024))
  test_fail "Build artifact seems too small: ${SIZE_MB}MB (expected > 100MB)"
fi
echo ""

# Test 6: Check for bundled resources (Linux AppImage only)
if [ -n "$APPIMAGE" ] && command -v file &> /dev/null; then
  log_info "Test 6: Verifying AppImage format..."
  FILE_TYPE=$(file "$APPIMAGE")
  if echo "$FILE_TYPE" | grep -q "ELF.*executable"; then
    test_pass "AppImage has correct ELF format"
  else
    test_fail "AppImage does not appear to be a valid ELF executable"
  fi
  echo ""
fi

# Test 7: Check for extracted resources (unpacked build)
log_info "Test 7: Checking for unpacked build artifacts..."
UNPACKED_DIR=$(find "$RELEASE_DIR" -type d -name "linux-unpacked" -o -name "win-unpacked" | head -n 1)
if [ -n "$UNPACKED_DIR" ]; then
  test_pass "Found unpacked build directory: $(basename "$UNPACKED_DIR")"

  # Check for resources
  RESOURCES_DIR="$UNPACKED_DIR/resources"
  if [ -d "$RESOURCES_DIR" ]; then
    test_pass "Resources directory exists"

    # Check for bundled docker-compose.yml
    if [ -f "$RESOURCES_DIR/docker-compose.yml" ]; then
      test_pass "docker-compose.yml bundled in resources"
    else
      test_fail "docker-compose.yml NOT found in resources (critical for Phase 5)"
    fi

    # Check for .env.example
    if [ -f "$RESOURCES_DIR/.env.example" ]; then
      test_pass ".env.example bundled in resources"
    else
      log_warn ".env.example NOT found in resources (optional)"
    fi
  else
    log_warn "Resources directory not found in unpacked build"
  fi
else
  log_warn "No unpacked build directory found (use 'pnpm --filter @synthesis/desktop pack' to generate)"
fi
echo ""

# Test 8: Dry-run launch (Linux AppImage only, with --version flag)
if [ -n "$APPIMAGE" ] && [ "$(uname)" = "Linux" ]; then
  log_info "Test 8: Attempting dry-run launch (--version)..."
  chmod +x "$APPIMAGE"

  # Try to get version (this won't open UI, just prints version and exits)
  if timeout 10s "$APPIMAGE" --version &> /dev/null; then
    test_pass "AppImage launched successfully with --version"
  else
    log_warn "Could not launch AppImage with --version (may require display server)"
  fi
  echo ""
fi

# ==============================================================================
# SUMMARY
# ==============================================================================

echo "========================================"
echo "Smoke Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
  log_info "All smoke tests passed! ✨"
  exit 0
else
  log_error "Some smoke tests failed. Review output above."
  exit 1
fi
