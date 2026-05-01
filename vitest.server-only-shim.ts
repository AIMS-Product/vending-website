// Vitest runs in Node without the React Server Components condition, so
// `import "server-only"` would throw at module load. This empty module is
// aliased in `vitest.config.ts` to keep server-only modules importable in
// unit tests without weakening the runtime guard.
export {};
