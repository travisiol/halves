// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// ERC-8056 scaled-amount tokens expose a multiplier; balances stay raw and the multiplier carries reinvested dividends.
interface IScaledAmount {
    function uiMultiplier() external view returns (uint256);
}

/// One half of a split: pX (principal) or yX (yield). Only its series mints and burns.
/// The yield half tells the series before every balance change, so accrued yield follows the holder.
contract HalfToken is ERC20 {
    Series public immutable series;
    bool public immutable isYield;
    uint8 private immutable _dec;

    error OnlySeries();

    constructor(string memory name_, string memory symbol_, uint8 dec_, bool isYield_) ERC20(name_, symbol_) {
        series = Series(msg.sender);
        isYield = isYield_;
        _dec = dec_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != address(series)) revert OnlySeries();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != address(series)) revert OnlySeries();
        _burn(from, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (isYield && msg.sender != address(series)) series.checkpoint(from, to);
        super._update(from, to, value);
    }
}

/**
 * A series splits one stock token, until one maturity, into pX and yX.
 *
 * Units: pX and yX are counted in "shares" — the stock token's displayed amount.
 * For an ERC-8056 token (useMultiplier) shares = raw × uiMultiplier / 1e18; for any other token shares = raw.
 *
 * - split(s): pulls the raw tokens worth s shares (rounded up) and mints s pX + s yX.
 * - merge(s): burns s pX + s yX and returns the raw tokens worth s shares (rounded down), any time.
 * - Yield: whatever the vault holds above the raw tokens owed to principal (pX supply in shares, at today's
 *   multiplier) and above the yield already credited. It comes from the multiplier rising (fewer raw tokens
 *   needed per share) or from the raw balance rising (rebasing tokens). It is credited to yX holders pro rata.
 * - A balance or multiplier drop eats the uncredited buffer first and blocks new yield until recovered;
 *   claims are capped so they never take tokens owed to principal.
 * - Maturity: the first call at or after `maturity` credits the last yield and freezes the series. From then on pX
 *   redeems pro rata everything except the yield still owed, and yX only claims what it was credited.
 *
 * No owner, no fee, no admin function.
 */
contract Series is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant ONE = 1e18;
    uint256 private constant ACC = 1e36;

    IERC20 public immutable stock;
    uint256 public immutable maturity;
    bool public immutable useMultiplier;
    HalfToken public immutable pToken;
    HalfToken public immutable yToken;

    bool public settled;
    /// Raw stock tokens credited to yX holders and not yet claimed.
    uint256 public owedYield;
    /// Accumulated raw yield per yX share, scaled by 1e36.
    uint256 public accPerY;
    mapping(address => uint256) public accPaid;
    mapping(address => uint256) public credited;

    event Split(address indexed who, uint256 shares, uint256 raw);
    event Merged(address indexed who, uint256 shares, uint256 raw);
    event YieldAccrued(uint256 raw, uint256 accPerY);
    event YieldClaimed(address indexed who, uint256 raw);
    event PrincipalRedeemed(address indexed who, uint256 shares, uint256 raw);
    event Settled(uint256 multiplier, uint256 principalRaw, uint256 owedYield);

    error ZeroAmount();
    error Matured();
    error NotMatured();
    error FeeOnTransfer();
    error OnlyYieldToken();

    constructor(address stock_, uint256 maturity_, bool useMultiplier_, string memory sym) {
        stock = IERC20(stock_);
        maturity = maturity_;
        useMultiplier = useMultiplier_;
        uint8 dec = IERC20Metadata(stock_).decimals();
        pToken = new HalfToken(string.concat("Principal ", sym), string.concat("p", sym), dec, false);
        yToken = new HalfToken(string.concat("Yield ", sym), string.concat("y", sym), dec, true);
    }

    // ── views ──

    function multiplier() public view returns (uint256) {
        return useMultiplier ? IScaledAmount(address(stock)).uiMultiplier() : ONE;
    }

    function rawBalance() public view returns (uint256) {
        return stock.balanceOf(address(this));
    }

    /// Raw tokens owed to principal before maturity: pX supply at today's multiplier, rounded up.
    function principalRaw() public view returns (uint256) {
        if (settled) return _sub(rawBalance(), owedYield);
        return _ceilDiv(pToken.totalSupply() * ONE, multiplier());
    }

    /// Raw yield not yet credited to anyone (what the next sync would hand out).
    function pendingYield() public view returns (uint256) {
        if (settled || yToken.totalSupply() == 0) return 0;
        return _sub(rawBalance(), principalRaw() + owedYield);
    }

    /// Raw stock a holder can claim now (credited + pending share), capped by what is not owed to principal.
    function claimable(address who) external view returns (uint256) {
        uint256 acc = accPerY;
        uint256 ys = yToken.totalSupply();
        uint256 p = pendingYield();
        if (p > 0 && ys > 0) acc += (p * ACC) / ys;
        uint256 c = credited[who] + (yToken.balanceOf(who) * (acc - accPaid[who])) / ACC;
        uint256 free = settled ? owedYield : _sub(rawBalance(), principalRaw());
        return c < free ? c : free;
    }

    function sharesToRaw(uint256 shares, bool up) public view returns (uint256) {
        uint256 m = multiplier();
        return up ? _ceilDiv(shares * ONE, m) : (shares * ONE) / m;
    }

    // ── actions ──

    function split(uint256 shares) external nonReentrant returns (uint256 raw) {
        if (shares == 0) revert ZeroAmount();
        _sync();
        if (settled) revert Matured();
        raw = sharesToRaw(shares, true);
        _credit(msg.sender);
        uint256 before = rawBalance();
        stock.safeTransferFrom(msg.sender, address(this), raw);
        if (rawBalance() - before != raw) revert FeeOnTransfer();
        pToken.mint(msg.sender, shares);
        yToken.mint(msg.sender, shares);
        emit Split(msg.sender, shares, raw);
    }

    function merge(uint256 shares) external nonReentrant returns (uint256 raw) {
        if (shares == 0) revert ZeroAmount();
        _sync();
        _credit(msg.sender);
        if (settled) {
            raw = _principalOut(shares);
        } else {
            raw = sharesToRaw(shares, false);
        }
        pToken.burn(msg.sender, shares);
        yToken.burn(msg.sender, shares);
        stock.safeTransfer(msg.sender, raw);
        emit Merged(msg.sender, shares, raw);
    }

    function claimYield() public nonReentrant returns (uint256 raw) {
        raw = _claim(msg.sender);
    }

    function redeemPrincipal(uint256 shares) external nonReentrant returns (uint256 raw) {
        if (shares == 0) revert ZeroAmount();
        _sync();
        if (!settled) revert NotMatured();
        raw = _principalOut(shares);
        pToken.burn(msg.sender, shares);
        stock.safeTransfer(msg.sender, raw);
        emit PrincipalRedeemed(msg.sender, shares, raw);
    }

    /// After maturity: claim the credited yield and burn the yX, which earns nothing more.
    function redeemYield() external nonReentrant returns (uint256 raw) {
        _sync();
        if (!settled) revert NotMatured();
        raw = _claim(msg.sender);
        uint256 bal = yToken.balanceOf(msg.sender);
        if (bal > 0) yToken.burn(msg.sender, bal);
    }

    /// Anyone may freeze the series once maturity has passed.
    function settle() external nonReentrant {
        _sync();
        if (!settled) revert NotMatured();
    }

    /// Called by the yield token before every transfer so accrued yield stays with its holder.
    function checkpoint(address from, address to) external {
        if (msg.sender != address(yToken)) revert OnlyYieldToken();
        _sync();
        if (from != address(0)) _credit(from);
        if (to != address(0)) _credit(to);
    }

    // ── internals ──

    function _sync() internal {
        if (settled) return;
        uint256 ys = yToken.totalSupply();
        if (ys > 0) {
            uint256 p = _sub(rawBalance(), principalRaw() + owedYield);
            uint256 inc = (p * ACC) / ys;
            if (inc > 0) {
                accPerY += inc;
                uint256 dist = (inc * ys) / ACC; // rounded down: dust stays in the vault
                owedYield += dist;
                emit YieldAccrued(dist, accPerY);
            }
        }
        if (block.timestamp >= maturity) {
            uint256 m = multiplier();
            settled = true;
            emit Settled(m, _sub(rawBalance(), owedYield), owedYield);
        }
    }

    function _credit(address who) internal {
        uint256 bal = yToken.balanceOf(who);
        uint256 a = accPerY;
        if (bal > 0) credited[who] += (bal * (a - accPaid[who])) / ACC;
        accPaid[who] = a;
    }

    function _claim(address who) internal returns (uint256 raw) {
        _sync();
        _credit(who);
        uint256 c = credited[who];
        uint256 free = settled ? owedYield : _sub(rawBalance(), principalRaw());
        raw = c < free ? c : free;
        if (raw == 0) return 0;
        credited[who] = c - raw;
        owedYield = _sub(owedYield, raw);
        stock.safeTransfer(who, raw);
        emit YieldClaimed(who, raw);
    }

    /// After settlement: pX takes its pro-rata part of everything not owed to yield, rounded down.
    function _principalOut(uint256 shares) internal view returns (uint256) {
        uint256 pool = _sub(rawBalance(), owedYield);
        return (pool * shares) / pToken.totalSupply();
    }

    function _sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : 0;
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
