import { concat, encodeAbiParameters, keccak256, toBytes, type Hex } from 'viem';
import type { ArticleAllocation } from './articleRewards';

export const articleContentId = (id: string) => keccak256(toBytes(id));
export function articleRewardLeaf(chainId: bigint, distributor: `0x${string}`, articleId: Hex, recipient: `0x${string}`, amount: bigint) {
  return keccak256(keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address' }, { type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
    [chainId, distributor, articleId, recipient, amount],
  )));
}
const pair = (a: Hex, b: Hex) => keccak256(concat(a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a]));
export function buildArticleRewardProofs(allocation: ArticleAllocation, chainId: bigint, distributor: `0x${string}`) {
  const articleId = articleContentId(allocation.articleId);
  const entries = allocation.beneficiaries.map(entry => ({ ...entry, leaf: articleRewardLeaf(chainId, distributor, articleId, entry.account as `0x${string}`, entry.amount) }))
    .sort((a, b) => a.leaf.localeCompare(b.leaf));
  if (!entries.length) return { articleId, root: `0x${'0'.repeat(64)}` as Hex, budget: 0n, claims: [] };
  const layers: Hex[][] = [entries.map(entry => entry.leaf)];
  while (layers.at(-1)!.length > 1) {
    const current = layers.at(-1)!;
    const next: Hex[] = [];
    for (let i = 0; i < current.length; i += 2) next.push(current[i + 1] ? pair(current[i], current[i + 1]) : current[i]);
    layers.push(next);
  }
  return {
    articleId, root: layers.at(-1)![0], budget: entries.reduce((sum, entry) => sum + entry.amount, 0n),
    claims: entries.map((entry, index) => {
      const proof: Hex[] = [];
      for (let depth = 0; depth < layers.length - 1; depth++) {
        const sibling = index ^ 1;
        if (layers[depth][sibling]) proof.push(layers[depth][sibling]);
        index = Math.floor(index / 2);
      }
      return { account: entry.account, amount: entry.amount, proof };
    }),
  };
}
