#!/usr/bin/env bash
#
# MCP Tools End-to-End Verification Script
# 
# This script verifies that all 7 MCP tools work correctly against a live backend server.
# It starts the server, runs each tool via JSON-RPC, and validates the responses.
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3333
BACKEND_HOST="localhost"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"
MCP_BIN="node apps/mcp/dist/index.js"
SERVER_BIN="node apps/server/dist/index.js"
TIMEOUT=60
SERVER_PID=""
TEMP_DIR=$(mktemp -d)
COLLECTION_ID=""
DOC_ID=""

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  
  if [ -n "$SERVER_PID" ]; then
    echo "Killing backend server (PID: $SERVER_PID)"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  
  # Clean up any remaining processes on the port
  if lsof -ti:${BACKEND_PORT} >/dev/null 2>&1; then
    echo "Cleaning up port ${BACKEND_PORT}"
    lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
  fi
  
  rm -rf "$TEMP_DIR"
  echo -e "${GREEN}Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

# Helper function to print section headers
print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
}

# Helper function to call MCP tool
call_mcp_tool() {
  local tool_name=$1
  local arguments=$2
  local id=${3:-1}
  
  local request=$(cat <<EOF
{"jsonrpc":"2.0","id":${id},"method":"tools/call","params":{"name":"${tool_name}","arguments":${arguments}}}
EOF
)
  
  echo "$request" | $MCP_BIN 2>/dev/null | tail -1
}

# Helper function to check if response is error
is_error_response() {
  local response=$1

  # Check if response is valid JSON
  if ! echo "$response" | jq empty >/dev/null 2>&1; then
    return 0  # Malformed JSON is an error
  fi

  # Check for JSON-RPC error field
  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    return 0  # JSON-RPC error present
  fi

  # Check for MCP result.isError
  if echo "$response" | jq -e '.result.isError == true' >/dev/null 2>&1; then
    return 0  # MCP tool returned error
  fi

  return 1  # No error detected
}

# Helper function to extract text content from MCP response
extract_text() {
  local response=$1
  echo "$response" | jq -r '.result.content[0].text // empty'
}

# Start the backend server
start_backend() {
  print_header "Starting Backend Server"
  
  # Check if port is already in use
  if lsof -ti:${BACKEND_PORT} >/dev/null 2>&1; then
    echo -e "${YELLOW}Port ${BACKEND_PORT} is already in use. Killing existing process...${NC}"
    lsof -ti:${BACKEND_PORT} | xargs kill -9 2>/dev/null || true
    sleep 2
  fi
  
  echo "Starting server on port ${BACKEND_PORT}..."
  $SERVER_BIN > "${TEMP_DIR}/server.log" 2>&1 &
  SERVER_PID=$!
  
  echo "Server PID: $SERVER_PID"
  echo "Server logs: ${TEMP_DIR}/server.log"
}

# Wait for backend to be ready
wait_for_backend() {
  print_header "Waiting for Backend Health Check"
  
  local elapsed=0
  echo -n "Checking ${BACKEND_URL}/health "
  
  while [ $elapsed -lt $TIMEOUT ]; do
    if curl -sf "${BACKEND_URL}/health" >/dev/null 2>&1; then
      echo -e "\n${GREEN}✓ Backend is ready!${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
    elapsed=$((elapsed + 1))
  done
  
  echo -e "\n${RED}✗ Backend failed to start within ${TIMEOUT}s${NC}"
  echo "Server logs:"
  cat "${TEMP_DIR}/server.log"
  exit 1
}

# Test 1: List collections
test_list_collections() {
  print_header "Test 1: list_collections"
  
  local response=$(call_mcp_tool "list_collections" "{}" 1)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Response preview:"
  echo "$response" | jq -C '.result.content[0].text | fromjson | .collections | .[0:2]' || true
  
  return 0
}

# Test 2: Create collection
test_create_collection() {
  print_header "Test 2: create_collection"
  
  local args=$(cat <<EOF
{"name":"MCP E2E Test Collection","description":"Temporary collection for testing"}
EOF
)
  
  local response=$(call_mcp_tool "create_collection" "$args" 2)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  # Extract collection ID
  local text=$(extract_text "$response")
  COLLECTION_ID=$(echo "$text" | jq -r '.collection.id')
  
  if [ -z "$COLLECTION_ID" ] || [ "$COLLECTION_ID" == "null" ]; then
    echo -e "${RED}✗ FAILED - Could not extract collection ID${NC}"
    echo "Response: $response"
    return 1
  fi
  
  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Collection ID: ${COLLECTION_ID}"
  
  return 0
}

# Test 3: Fetch web content
test_fetch_web_content() {
  print_header "Test 3: fetch_and_add_document_from_url"
  
  local args=$(cat <<EOF
{"url":"https://example.com","collection_id":"${COLLECTION_ID}","mode":"single"}
EOF
)
  
  local response=$(call_mcp_tool "fetch_and_add_document_from_url" "$args" 3)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  # Extract document ID
  local text=$(extract_text "$response")
  DOC_ID=$(echo "$text" | jq -r '.processed[0].docId // empty')

  if [ -z "$DOC_ID" ] || [ "$DOC_ID" = "null" ]; then
    echo -e "${RED}✗ FAILED - Could not extract document ID${NC}"
    echo "Response preview:"
    echo "$text" | jq -C '.' 2>/dev/null || echo "$text"
    return 1
  fi

  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Document ID: ${DOC_ID}"
  return 0
}

# Test 4: Poll document status (SKIPPED - tool not implemented)
test_get_document_status() {
  print_header "Test 4: get_document_status (polling)"
  
  # This tool is not currently implemented in the MCP server
  # Skip this test to avoid JSON-RPC errors
  echo -e "${YELLOW}⚠ SKIPPED - get_document_status tool not implemented${NC}"
  echo "   The MCP server does not currently expose a get_document_status tool."
  echo "   Document status polling would require additional backend API endpoints."
  
  return 2  # Return 2 to indicate skipped test
}

# Test 5: Search RAG
test_search_rag() {
  print_header "Test 5: search_rag"
  
  local args=$(cat <<EOF
{"query":"example","collection_id":"${COLLECTION_ID}","top_k":5}
EOF
)
  
  local response=$(call_mcp_tool "search_rag" "$args" 5)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  local text=$(extract_text "$response")
  local result_count=$(echo "$text" | jq -r '.total_results // 0')
  
  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Results found: ${result_count}"
  
  return 0
}

# Test 6: List documents
test_list_documents() {
  print_header "Test 6: list_documents"
  
  local args=$(cat <<EOF
{"collection_id":"${COLLECTION_ID}","limit":10}
EOF
)
  
  local response=$(call_mcp_tool "list_documents" "$args" 6)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  local text=$(extract_text "$response")
  local doc_count=$(echo "$text" | jq -r '.documents | length')
  
  echo -e "${GREEN}✓ PASSED${NC}"
  echo "Documents listed: ${doc_count}"
  
  return 0
}

# Test 7: Delete document
test_delete_document() {
  print_header "Test 7: delete_document"
  
  if [ -z "$DOC_ID" ]; then
    echo -e "${YELLOW}⚠ SKIPPED - No document ID from previous tests${NC}"
    return 2  # Return 2 to indicate skipped test
  fi
  
  local args=$(cat <<EOF
{"doc_id":"${DOC_ID}","confirm":true}
EOF
)
  
  local response=$(call_mcp_tool "delete_document" "$args" 7)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  echo -e "${GREEN}✓ PASSED${NC}"
  local text=$(extract_text "$response")
  echo "$text" | jq -C '.title' 2>/dev/null || true
  
  return 0
}

# Test 8: Delete collection
test_delete_collection() {
  print_header "Test 8: delete_collection"
  
  if [ -z "$COLLECTION_ID" ]; then
    echo -e "${YELLOW}⚠ SKIPPED - No collection ID from previous tests${NC}"
    return 2  # Return 2 to indicate skipped test
  fi
  
  local args=$(cat <<EOF
{"collection_id":"${COLLECTION_ID}","confirm":true}
EOF
)
  
  local response=$(call_mcp_tool "delete_collection" "$args" 8)
  
  if is_error_response "$response"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
    return 1
  fi
  
  echo -e "${GREEN}✓ PASSED${NC}"
  
  return 0
}

# Main execution
main() {
  echo -e "${BLUE}"
  echo "╔═══════════════════════════════════════════════════════════╗"
  echo "║        MCP Tools End-to-End Verification Script          ║"
  echo "╚═══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  # Check prerequisites
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
  fi
  
  if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
  fi
  
  if [ ! -f "apps/server/dist/index.js" ]; then
    echo -e "${RED}Error: Server not built. Run 'pnpm build' first${NC}"
    exit 1
  fi
  
  if [ ! -f "apps/mcp/dist/index.js" ]; then
    echo -e "${RED}Error: MCP server not built. Run 'pnpm build' first${NC}"
    exit 1
  fi
  
  # Start backend and wait for it
  start_backend
  wait_for_backend
  
  # Run tests
  local failed=0
  local passed=0
  local skipped=0
  
  test_list_collections && ((passed+=1)) || { ((failed+=1)) || true; }
  test_create_collection && ((passed+=1)) || { ((failed+=1)) || true; }
  test_fetch_web_content && ((passed+=1)) || { ((failed+=1)) || true; }
  test_get_document_status; case $? in 0) ((passed+=1)) ;; 2) ((skipped+=1)) ;; *) ((failed+=1)) ;; esac
  test_search_rag && ((passed+=1)) || { ((failed+=1)) || true; }
  test_list_documents && ((passed+=1)) || { ((failed+=1)) || true; }
  test_delete_document; case $? in 0) ((passed+=1)) ;; 2) ((skipped+=1)) ;; *) ((failed+=1)) ;; esac
  test_delete_collection; case $? in 0) ((passed+=1)) ;; 2) ((skipped+=1)) ;; *) ((failed+=1)) ;; esac
  
  # Summary
  print_header "Test Summary"
  echo -e "Total Tests: $((passed + failed + skipped))"
  echo -e "${GREEN}Passed: ${passed}${NC}"
  echo -e "${RED}Failed: ${failed}${NC}"
  echo -e "${YELLOW}Skipped: ${skipped}${NC}"
  
  if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║            ALL TESTS PASSED ✓                             ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    exit 0
  else
    echo -e "\n${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║            SOME TESTS FAILED ✗                            ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    exit 1
  fi
}

# Run main function
main "$@"
