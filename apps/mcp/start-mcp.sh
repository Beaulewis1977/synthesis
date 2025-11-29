#!/bin/bash

# Absolute path to the specific Node.js executable in WSL
NODE_EXEC="/home/kngpnn/.nvm/versions/node/v20.19.5/bin/node"

# Absolute path to the MCP server script
MCP_SCRIPT="/home/kngpnn/dev/synthesis/apps/mcp/dist/index.js"

# Run the server
"$NODE_EXEC" "$MCP_SCRIPT"
