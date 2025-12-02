# Mobile SaaS Agent Scenarios

Scenario-based evaluation tests for MCP tools used in mobile SaaS development workflows.

## Purpose

These scenarios validate that the Phase 3 MCP tools work correctly for real-world mobile development tasks:
- Feature design workflows
- Implementation workflows
- Integration/analysis workflows
- Maintenance workflows

## Scenarios

| Scenario | File | Primary Tools |
|----------|------|---------------|
| Flutter + Supabase Auth | `flutter_supabase_auth.md` | get_feature_recipe, find_code_examples, search_mobile_docs, get_db_schema |
| Stripe Billing Integration | `flutter_stripe_billing.md` | get_feature_recipe, get_project_tech_stack, find_code_examples |
| Firebase Push Notifications | `firebase_push_notifications.md` | get_feature_recipe, find_code_examples, get_project_tech_stack |
| User Settings Persistence Trace | `user_settings_trace.md` | get_db_schema, graph_expand_context, find_symbol_usages |

## Running Scenarios

Use the MCP scenario runner:

```bash
# Dry-run (validate config without API calls)
node apps/server/perf/mcp_scenario_runner.mjs --dry-run

# Live run against local server
node apps/server/perf/mcp_scenario_runner.mjs --base-url http://localhost:3333

# Run specific scenario
node apps/server/perf/mcp_scenario_runner.mjs --scenario flutter-supabase-auth

# Verbose output
node apps/server/perf/mcp_scenario_runner.mjs --verbose
```

## Scenario File Format

Each scenario markdown file contains:

1. **Overview** - Goal, starting collection, primary tools
2. **Preconditions** - Required collections/documents
3. **Workflow Steps** - Tool calls with expected outcomes
4. **Success Criteria** - Tools used, patterns found, sources consulted
5. **Expected Outcome** - Final deliverable description

## Success Metrics

A scenario passes when:
- All required tools are called at least once
- Each step returns expected results or handles errors gracefully
- Final outcome aligns with recipes and official documentation

## Related Documentation

- Tool Specifications: `docs/mcp/MCP_TOOL_SPEC_GPT_PHASE3.md`
- Tool Selection Guide: `docs/mcp/MCP_TOOL_SELECTION_DECISION_TREE.md`
- Agent Usage Guide: `docs/mcp/MCP_AGENT_TOOL_USAGE_GUIDE.md`
