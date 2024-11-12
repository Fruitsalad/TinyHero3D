export function getCachedOrCompute<In, Out>(
  input: In, cache: Map<In, Out>, compute: (input: In) => Out
): Out {
  const cached = cache.get(input);
  if (cached !== undefined)
    return cached;
  const output = compute(input);
  cache.set(input, output);
  return output;
}

export async function getCachedOrComputeAsync<In, Out>(
  input: In, cache: Map<In, Out>, compute: (input: In) => Promise<Out>
): Promise<Out> {
  const cached = cache.get(input);
  if (cached !== undefined)
    return cached;
  const output = await compute(input);
  cache.set(input, output);
  return output;
}