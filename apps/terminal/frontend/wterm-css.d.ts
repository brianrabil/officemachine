// `@wterm/react`'s "./css" package export maps to a real .css file, but the
// subpath itself has no extension, so Next's built-in `declare module '*.css'`
// wildcard doesn't match it. This ambient module fills that gap for tsc.
declare module "@wterm/react/css";
