// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Series, IScaledAmount} from "./Series.sol";

/// Creates one Series per (stock token, maturity). No owner: anyone may open a series.
contract SeriesFactory {
    /// 2027-12-31 00:00:00 UTC — the maturity the site offers by default.
    uint256 public constant DEFAULT_MATURITY = 1830211200;
    /// Splitting and merging are free; there is no fee anywhere in the contracts.
    uint256 public constant SPLIT_FEE_BPS = 0;
    uint256 public constant MERGE_FEE_BPS = 0;

    address[] public allSeries;
    mapping(address => mapping(uint256 => address)) public seriesFor;

    event SeriesCreated(address indexed stock, uint256 indexed maturity, address series, address pToken, address yToken, bool useMultiplier);

    error Exists();
    error PastMaturity();

    function createSeries(address stock, uint256 maturity) external returns (address s) {
        if (maturity == 0) maturity = DEFAULT_MATURITY;
        if (maturity <= block.timestamp) revert PastMaturity();
        if (seriesFor[stock][maturity] != address(0)) revert Exists();
        bool useMult = _hasMultiplier(stock);
        Series series = new Series(stock, maturity, useMult, IERC20Metadata(stock).symbol());
        s = address(series);
        seriesFor[stock][maturity] = s;
        allSeries.push(s);
        emit SeriesCreated(stock, maturity, s, address(series.pToken()), address(series.yToken()), useMult);
    }

    function seriesCount() external view returns (uint256) {
        return allSeries.length;
    }

    function listSeries() external view returns (address[] memory) {
        return allSeries;
    }

    /// True when the token answers uiMultiplier() with a non-zero value (ERC-8056 scaled amounts).
    function _hasMultiplier(address stock) internal view returns (bool) {
        try IScaledAmount(stock).uiMultiplier() returns (uint256 m) {
            return m > 0;
        } catch {
            return false;
        }
    }
}
