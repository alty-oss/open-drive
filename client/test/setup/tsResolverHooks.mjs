





const CANDIDATE_EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  const candidate = specifier.startsWith('@/')
    ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href
    : specifier;
  try {
    return await nextResolve(candidate, context);
  } catch (error) {
    const isLocal =
      candidate.startsWith('./') ||
      candidate.startsWith('../') ||
      candidate.startsWith('file:');
    if (!isLocal) throw error;

    for (const extension of CANDIDATE_EXTENSIONS) {
      try {
        return await nextResolve(`${candidate}${extension}`, context);
      } catch {

      }
    }
    throw error;
  }
}
