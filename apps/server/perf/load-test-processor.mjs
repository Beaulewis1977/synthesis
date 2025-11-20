const { LOAD_TEST_COLLECTION_ID } = process.env;

if (!LOAD_TEST_COLLECTION_ID) {
  throw new Error('LOAD_TEST_COLLECTION_ID env var must be set before running load tests');
}

export function prepareSearch(userContext, events, done) {
  const queries = userContext.vars.queries || ['performance'];
  const stacks = userContext.vars.tech_filters || [[]];

  const query = queries[Math.floor(Math.random() * queries.length)];
  const stack = stacks[Math.floor(Math.random() * stacks.length)];

  userContext.vars.current_query = query;
  userContext.vars.current_stack = stack;

  done();
}
