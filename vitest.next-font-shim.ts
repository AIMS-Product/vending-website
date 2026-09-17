/**
 * `next/font/google` is a build-time transform that Next applies during
 * compilation; under vitest the real module throws ("Anton is not a function").
 * Components that set a display face still have to render in SSR tests, so this
 * stands in with the same shape next/font returns.
 *
 * One export per face the app actually loads. Adding a face without adding it
 * here fails the suite with a clear import error rather than silently dropping
 * the font, which is the behaviour we want.
 */
type FontResult = {
  className: string;
  variable: string;
  style: { fontFamily: string };
};

function stub(name: string) {
  return (): FontResult => ({
    className: `__vitest_${name}`,
    variable: `__vitest_${name}_variable`,
    style: { fontFamily: name },
  });
}

export const Anton = stub("Anton");
export const Inter = stub("Inter");
