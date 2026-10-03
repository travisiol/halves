/**
 * Local only (hardhat node on 8905).
 *   PHASE=deploy    npx hardhat run scripts/play-local.ts --network localhost
 *     deploys SeriesFactory + an ERC-8056-like SPY mock, opens the default-maturity series,
 *     funds the UI test account (#3) with 100 SPY.
 *   PHASE=multiplier M=1.25 ...  raises the mock's multiplier (a reinvested dividend).
 *   PHASE=lifecycle ...          two wallets: split, transfer yX, rebase up, claim, merge,
 *     warp past maturity, redeem principal and yield; every balance checked to the wei.
 */
import { ethers, network } from "hardhat";

const E = (n: string | number) => ethers.parseEther(String(n));
const FACTORY = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STOCK = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const MATURITY = 1830211200n;

function eq(label: string, got: bigint, want: bigint) {
  const ok = got === want;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${ethers.formatEther(got)}${ok ? "" : ` (want ${ethers.formatEther(want)})`}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const phase = process.env.PHASE ?? "deploy";
  const signers = await ethers.getSigners();
  if (phase === "deploy") {
    const factory = await (await ethers.getContractFactory("SeriesFactory")).deploy();
    const stock = await (await ethers.getContractFactory("MockScaledStock")).deploy("SPDR S&P 500 ETF", "SPY");
    console.log("factory", await factory.getAddress(), "stock", await stock.getAddress());
    await (await factory.createSeries(await stock.getAddress(), 0)).wait();
    console.log("series", await factory.seriesFor(await stock.getAddress(), MATURITY));
    await (await stock.mint(signers[3].address, E(100))).wait();
    return;
  }
  const stock = await ethers.getContractAt("MockScaledStock", STOCK);
  if (phase === "multiplier") {
    await (await stock.setMultiplier(E(process.env.M ?? "1.25"))).wait();
    console.log("multiplier", ethers.formatEther(await stock.uiMultiplier()));
    return;
  }
  // lifecycle: a second series on a fresh stock mock so the UI account's state is untouched
  const [deployer, alice, bob] = signers;
  const factory = await ethers.getContractAt("SeriesFactory", FACTORY);
  const spy = await (await ethers.getContractFactory("MockScaledStock")).deploy("SPDR S&P 500 ETF", "SPY");
  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const maturity = BigInt(now + 30 * 86400);
  await (await factory.connect(deployer).createSeries(await spy.getAddress(), maturity)).wait();
  const series = await ethers.getContractAt("Series", await factory.seriesFor(await spy.getAddress(), maturity));
  const y = await ethers.getContractAt("HalfToken", await series.yToken());
  for (const s of [alice, bob]) {
    await (await spy.mint(s.address, E(100))).wait();
    await (await spy.connect(s).approve(await series.getAddress(), ethers.MaxUint256)).wait();
  }
  await (await series.connect(alice).split(E(60))).wait();
  await (await series.connect(bob).split(E(20))).wait();
  eq("vault after splits", await spy.balanceOf(await series.getAddress()), E(80));
  await (await y.connect(alice).transfer(bob.address, E(20))).wait(); // alice 40 y, bob 40 y
  await (await spy.setMultiplier(E("1.25"))).wait(); // principal 80 shares = 64 raw; 16 raw of yield
  eq("alice claimable", await series.claimable(alice.address), E(8));
  eq("bob claimable", await series.claimable(bob.address), E(8));
  await (await series.connect(alice).claimYield()).wait();
  eq("alice raw after claim", await spy.balanceOf(alice.address), E(48));
  await (await series.connect(bob).merge(E(20))).wait(); // returns 16 raw; bob's 8 stays credited
  eq("bob raw after merge", await spy.balanceOf(bob.address), E(96));
  eq("bob still claimable", await series.claimable(bob.address), E(8));
  await network.provider.send("evm_setNextBlockTimestamp", [Number(maturity) + 1]);
  await network.provider.send("evm_mine");
  await (await series.settle()).wait();
  await (await series.connect(alice).redeemPrincipal(E(60))).wait(); // 60 shares at 1.25 = 48 raw
  eq("alice raw after principal", await spy.balanceOf(alice.address), E(96));
  await (await series.connect(alice).redeemYield()).wait();
  eq("alice raw after yield (nothing left)", await spy.balanceOf(alice.address), E(96));
  await (await series.connect(bob).redeemYield()).wait();
  eq("bob raw final", await spy.balanceOf(bob.address), E(104));
  eq("vault empty", await spy.balanceOf(await series.getAddress()), 0n);
  eq("alice ySPY burnt", await y.balanceOf(alice.address), 0n);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
