import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const E = (n: string | number) => ethers.parseEther(String(n));

async function setup(kind: "scaled" | "rebasing") {
  const [deployer, alice, bob] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("SeriesFactory");
  const factory = await Factory.deploy();
  const stock =
    kind === "scaled"
      ? await (await ethers.getContractFactory("MockScaledStock")).deploy("SPDR S&P 500", "SPY")
      : await (await ethers.getContractFactory("MockRebasingStock")).deploy("SPDR S&P 500", "SPY");
  const maturity = (await time.latest()) + 365 * 86400;
  await factory.createSeries(await stock.getAddress(), maturity);
  const series = await ethers.getContractAt("Series", await factory.seriesFor(await stock.getAddress(), maturity));
  const p = await ethers.getContractAt("HalfToken", await series.pToken());
  const y = await ethers.getContractAt("HalfToken", await series.yToken());
  for (const s of [alice, bob]) {
    await stock.mint(s.address, E(1000));
    await stock.connect(s).approve(await series.getAddress(), ethers.MaxUint256);
  }
  return { deployer, alice, bob, factory, stock, series, p, y, maturity };
}

describe("SeriesFactory", () => {
  it("lists series, defaults the maturity and refuses duplicates", async () => {
    const { factory, stock, maturity } = await setup("scaled");
    expect(await factory.seriesCount()).to.equal(1n);
    await factory.createSeries(await stock.getAddress(), 0);
    expect(await factory.seriesFor(await stock.getAddress(), 1830211200)).to.not.equal(ethers.ZeroAddress);
    expect((await factory.listSeries()).length).to.equal(2);
    await expect(factory.createSeries(await stock.getAddress(), maturity)).to.be.revertedWithCustomError(factory, "Exists");
    await expect(factory.createSeries(await stock.getAddress(), 1000)).to.be.revertedWithCustomError(factory, "PastMaturity");
  });

  it("detects an ERC-8056 multiplier only where it exists", async () => {
    const a = await setup("scaled");
    const b = await setup("rebasing");
    expect(await a.series.useMultiplier()).to.equal(true);
    expect(await b.series.useMultiplier()).to.equal(false);
    expect(await a.p.symbol()).to.equal("pSPY");
    expect(await a.y.symbol()).to.equal("ySPY");
  });

  it("constants printed on the site equal the contract's", async () => {
    const { factory } = await setup("scaled");
    const site = JSON.parse(readFileSync(join(__dirname, "../../src/config/protocol.json"), "utf8"));
    expect(await factory.DEFAULT_MATURITY()).to.equal(BigInt(site.defaultMaturity));
    expect(await factory.SPLIT_FEE_BPS()).to.equal(BigInt(site.splitFeeBps));
    expect(await factory.MERGE_FEE_BPS()).to.equal(BigInt(site.mergeFeeBps));
  });
});

describe("Series (ERC-8056 multiplier)", () => {
  it("split and merge are exact", async () => {
    const { alice, stock, series, p, y } = await setup("scaled");
    await series.connect(alice).split(E(10));
    expect(await p.balanceOf(alice.address)).to.equal(E(10));
    expect(await y.balanceOf(alice.address)).to.equal(E(10));
    expect(await stock.balanceOf(alice.address)).to.equal(E(990));
    await series.connect(alice).merge(E(4));
    expect(await stock.balanceOf(alice.address)).to.equal(E(994));
    expect(await p.totalSupply()).to.equal(E(6));
  });

  it("yield accrues pro rata across two holders and follows a transfer of yX", async () => {
    const { alice, bob, stock, series, y } = await setup("scaled");
    await series.connect(alice).split(E(30));
    await series.connect(bob).split(E(10));
    // +25% multiplier: principal (40 shares) now needs 32 raw; 8 raw become yield.
    await stock.setMultiplier(E("1.25"));
    expect(await series.claimable(alice.address)).to.equal(E(6));
    expect(await series.claimable(bob.address)).to.equal(E(2));
    // Alice sends half her yX to Bob: what accrued before stays hers.
    await y.connect(alice).transfer(bob.address, E(15));
    await stock.setMultiplier(E("2")); // principal 40 shares now needs 20 raw: 4 more raw of yield... 40 raw held - 20 - 8 owed = 12 new
    expect(await series.claimable(alice.address)).to.equal(E(6) + E(12) * 15n / 40n);
    expect(await series.claimable(bob.address)).to.equal(E(2) + E(12) * 25n / 40n);
    const before = await stock.balanceOf(bob.address);
    await series.connect(bob).claimYield();
    expect((await stock.balanceOf(bob.address)) - before).to.equal(E("9.5"));
  });

  it("a multiplier drop reduces yield, never principal", async () => {
    const { alice, stock, series } = await setup("scaled");
    await series.connect(alice).split(E(100));
    await stock.setMultiplier(E("1.25")); // 20 raw of yield credited on next sync
    await series.settle().catch(() => undefined); // not matured: reverts, nothing happens
    await stock.setMultiplier(E("0.8")); // principal would need 125 raw, vault holds 100
    expect(await series.claimable(alice.address)).to.equal(0n);
    await series.connect(alice).claimYield();
    expect(await stock.balanceOf(await series.getAddress())).to.equal(E(100));
  });

  it("gates principal redemption on maturity, then pays principal and yield", async () => {
    const { alice, bob, stock, series, p, y, maturity } = await setup("scaled");
    await series.connect(alice).split(E(50));
    await series.connect(bob).split(E(50));
    await expect(series.connect(alice).redeemPrincipal(E(1))).to.be.revertedWithCustomError(series, "NotMatured");
    await expect(series.connect(alice).redeemYield()).to.be.revertedWithCustomError(series, "NotMatured");
    await stock.setMultiplier(E("1.25")); // 100 shares need 80 raw; 20 raw of yield
    await time.increaseTo(maturity);
    await series.settle();
    expect(await series.settled()).to.equal(true);
    await expect(series.connect(alice).split(E(1))).to.be.revertedWithCustomError(series, "Matured");
    const a0 = await stock.balanceOf(alice.address);
    await series.connect(alice).redeemPrincipal(E(50));
    expect((await stock.balanceOf(alice.address)) - a0).to.equal(E(40)); // 50 shares at 1.25
    await series.connect(alice).redeemYield();
    expect((await stock.balanceOf(alice.address)) - a0).to.equal(E(50));
    expect(await y.balanceOf(alice.address)).to.equal(0n);
    // Bob merges after maturity: principal part + credited yield claimable separately
    await series.connect(bob).merge(E(50));
    await series.connect(bob).claimYield();
    expect(await stock.balanceOf(bob.address)).to.equal(E(1000));
    expect(await p.totalSupply()).to.equal(0n);
    expect(await stock.balanceOf(await series.getAddress())).to.equal(0n);
  });

  it("refuses fee-on-transfer tokens", async () => {
    const [, alice] = await ethers.getSigners();
    const factory = await (await ethers.getContractFactory("SeriesFactory")).deploy();
    const fee = await (await ethers.getContractFactory("FeeOnTransferToken")).deploy();
    await factory.createSeries(await fee.getAddress(), 0);
    const series = await ethers.getContractAt("Series", await factory.seriesFor(await fee.getAddress(), 1830211200));
    await fee.mint(alice.address, E(10));
    await fee.connect(alice).approve(await series.getAddress(), ethers.MaxUint256);
    await expect(series.connect(alice).split(E(1))).to.be.revertedWithCustomError(series, "FeeOnTransfer");
  });

  it("only the series mints and only the yield token checkpoints", async () => {
    const { alice, series, p } = await setup("scaled");
    await expect(p.connect(alice).mint(alice.address, 1)).to.be.revertedWithCustomError(p, "OnlySeries");
    await expect(series.connect(alice).checkpoint(alice.address, alice.address)).to.be.revertedWithCustomError(series, "OnlyYieldToken");
  });
});

describe("Series (rebasing balance)", () => {
  it("balance growth becomes yield; a negative rebase eats yield first", async () => {
    const { alice, bob, stock, series } = await setup("rebasing");
    await series.connect(alice).split(E(40));
    await series.connect(bob).split(E(40));
    await stock.rebase(E("1.25")); // vault 80 → 100: 20 of yield
    expect(await series.claimable(alice.address)).to.equal(E(10));
    await stock.rebase(E("0.9")); // vault 72 < principal 80: no yield, principal intact as far as it goes
    expect(await series.claimable(alice.address)).to.equal(0n);
    await stock.rebase(E("1.25"));
    const b0 = await stock.balanceOf(bob.address);
    await series.connect(bob).claimYield();
    expect((await stock.balanceOf(bob.address)) - b0).to.equal(E(10));
    await series.connect(bob).merge(E(40));
    expect((await stock.balanceOf(bob.address)) - b0).to.equal(E(50));
  });
});
