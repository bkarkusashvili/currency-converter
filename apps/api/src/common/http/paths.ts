// The paths the process serves, in one place so the two files that have to
// agree with the routing — the Swagger setup and the request log level — do not
// each keep their own copy of a string the prefix wiring owns.
//
// They live in `common/` rather than beside `configureHttp`, because the
// alternative is a file under `common/` importing from the application root:
// the direction of every other dependency here is towards `common/`, and one
// pointing back is the kind of edge §9 exists to keep out.
export const GLOBAL_PREFIX = 'api/v1';
export const HEALTH_PATH = 'health';
export const HEALTH_LIVE_PATH = 'health/live';
export const DOCS_PATH = 'docs';
export const DOCS_JSON_PATH = 'docs-json';

// The two probe routes as a request's url shows them: unversioned, so the
// leading slash is all that is added. `configureHttp` excludes exactly these
// two from the versioned prefix, which is what keeps this true.
export const PROBE_PATHS: readonly string[] = [
  `/${HEALTH_PATH}`,
  `/${HEALTH_LIVE_PATH}`,
];
