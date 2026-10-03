import { erc20Abi, parseAbi } from "viem";

export { erc20Abi };

export const factoryAbi = parseAbi([
  "function DEFAULT_MATURITY() view returns (uint256)",
  "function seriesFor(address stock, uint256 maturity) view returns (address)",
  "function listSeries() view returns (address[])",
  "function createSeries(address stock, uint256 maturity) returns (address)",
]);

export const seriesAbi = parseAbi([
  "function stock() view returns (address)",
  "function maturity() view returns (uint256)",
  "function settled() view returns (bool)",
  "function pToken() view returns (address)",
  "function yToken() view returns (address)",
  "function multiplier() view returns (uint256)",
  "function rawBalance() view returns (uint256)",
  "function principalRaw() view returns (uint256)",
  "function pendingYield() view returns (uint256)",
  "function owedYield() view returns (uint256)",
  "function claimable(address who) view returns (uint256)",
  "function sharesToRaw(uint256 shares, bool up) view returns (uint256)",
  "function split(uint256 shares) returns (uint256)",
  "function merge(uint256 shares) returns (uint256)",
  "function claimYield() returns (uint256)",
  "function redeemPrincipal(uint256 shares) returns (uint256)",
  "function redeemYield() returns (uint256)",
  "function settle()",
]);
