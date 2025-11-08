#!/bin/bash

# Cost Routes Edge Case Testing Script
# Tests the fixes made to apps/server/src/routes/costs.ts

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="${BASE_URL:-http://localhost:3333}"

echo -e "${BOLD}===============================================${NC}"
echo -e "${BOLD}  Cost Routes Edge Case Testing${NC}"
echo -e "${BOLD}===============================================${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local test_name="$1"
    local url="$2"
    local expected_code="$3"
    local check_function="$4"
    
    echo -e "${YELLOW}Testing:${NC} $test_name"
    
    local tmp_stderr
    tmp_stderr=$(mktemp)
    local curl_status
    local curl_stderr

    # Run curl while collecting stderr so we can surface helpful error details on failure
    set +e
    response=$(curl -sS -w "\n%{http_code}" "$url" 2>"$tmp_stderr")
    curl_status=$?
    set -e

    curl_stderr=$(cat "$tmp_stderr")
    rm -f "$tmp_stderr"

    if [ $curl_status -ne 0 ]; then
        echo -e "  ${RED}✗${NC} curl failed with exit code $curl_status"
        if [ -n "$curl_stderr" ]; then
            echo -e "  stderr:"
            while IFS= read -r line; do
                echo "    $line"
            done <<< "$curl_stderr"
        fi
        return $curl_status
    fi

    body=$(echo "$response" | head -n -1)
    code=$(echo "$response" | tail -n 1)
    
    if [ "$code" = "$expected_code" ]; then
        echo -e "  ${GREEN}✓${NC} Status code: $code"
        
        if [ -n "$check_function" ]; then
            $check_function "$body"
        fi
    else
        echo -e "  ${RED}✗${NC} Expected status $expected_code, got $code"
        echo -e "  Response: $body"
        return 1
    fi
    echo ""
}

# Check functions
check_summary_budget() {
    local body="$1"
    budget=$(echo "$body" | grep -o '"budget":[0-9.]*' | cut -d: -f2)
    percentage=$(echo "$body" | grep -o '"percentage_used":[0-9.]*' | cut -d: -f2)
    
    if [ -n "$budget" ]; then
        echo -e "  ${GREEN}✓${NC} Budget: $budget"
    fi
    
    if [ -n "$percentage" ]; then
        # Check it's a finite number
        if [[ "$percentage" =~ ^[0-9]+\.?[0-9]*$ ]]; then
            echo -e "  ${GREEN}✓${NC} Percentage: $percentage% (finite)"
        else
            echo -e "  ${RED}✗${NC} Percentage is not finite: $percentage"
        fi
    fi
}

check_history_response() {
    local body="$1"
    if echo "$body" | grep -q '"history"'; then
        echo -e "  ${GREEN}✓${NC} History data returned"
    else
        echo -e "  ${RED}✗${NC} No history field in response"
    fi
}

check_error_message() {
    local body="$1"
    if echo "$body" | grep -q '"error"'; then
        error=$(echo "$body" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo -e "  ${GREEN}✓${NC} Error message: $error"
    else
        echo -e "  ${RED}✗${NC} No error field in response"
    fi
}

echo -e "${BOLD}1. Testing /api/costs/summary - Budget Validation${NC}"
echo "================================================="
echo ""

# Test with invalid budget env var (requires server restart for each)
echo -e "${YELLOW}Note:${NC} Budget validation tests require restarting server with different env vars"
echo -e "Current test will use whatever MONTHLY_BUDGET_USD is currently set"
echo ""

test_endpoint \
    "Valid summary request" \
    "$BASE_URL/api/costs/summary" \
    "200" \
    "check_summary_budget"

echo -e "${BOLD}2. Testing /api/costs/history - Date Validation${NC}"
echo "================================================"
echo ""

test_endpoint \
    "Valid date range" \
    "$BASE_URL/api/costs/history?start_date=2025-10-01&end_date=2025-10-14" \
    "200" \
    "check_history_response"

test_endpoint \
    "Invalid start_date" \
    "$BASE_URL/api/costs/history?start_date=not-a-date" \
    "400" \
    "check_error_message"

test_endpoint \
    "Invalid end_date" \
    "$BASE_URL/api/costs/history?end_date=invalid-date" \
    "400" \
    "check_error_message"

test_endpoint \
    "Malformed date" \
    "$BASE_URL/api/costs/history?start_date=2025-13-45" \
    "400" \
    "check_error_message"

test_endpoint \
    "No date parameters" \
    "$BASE_URL/api/costs/history" \
    "200" \
    "check_history_response"

test_endpoint \
    "Only start_date" \
    "$BASE_URL/api/costs/history?start_date=2025-10-01" \
    "200" \
    "check_history_response"

test_endpoint \
    "Only end_date" \
    "$BASE_URL/api/costs/history?end_date=2025-10-14" \
    "200" \
    "check_history_response"

echo -e "${BOLD}3. Testing /api/costs/alerts${NC}"
echo "=================================="
echo ""

test_endpoint \
    "Get alerts" \
    "$BASE_URL/api/costs/alerts" \
    "200" \
    ""

echo -e "${BOLD}===============================================${NC}"
echo -e "${GREEN}All edge case tests completed!${NC}"
echo -e "${BOLD}===============================================${NC}"
echo ""

echo -e "${YELLOW}Additional Manual Tests Needed:${NC}"
echo ""
echo "Test invalid budget values (requires server restart):"
echo "  1. MONTHLY_BUDGET_USD=invalid pnpm --filter @synthesis/server dev"
echo "  2. curl http://localhost:3333/api/costs/summary"
echo "  3. Check that budget=10 (default)"
echo ""
echo "  4. MONTHLY_BUDGET_USD=0 pnpm --filter @synthesis/server dev"
echo "  5. curl http://localhost:3333/api/costs/summary"
echo "  6. Check that budget=10 and percentage_used is not Infinity"
echo ""
echo "  7. MONTHLY_BUDGET_USD=-5 pnpm --filter @synthesis/server dev"
echo "  8. curl http://localhost:3333/api/costs/summary"
echo "  9. Check that budget=10"
echo ""
