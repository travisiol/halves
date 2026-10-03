// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Rebasing stand-in: balanceOf = raw × index / 1e18; rebase() moves the index (reinvested dividends). Local only.
contract MockRebasingStock is ERC20 {
    uint256 public index = 1e18;

    constructor(string memory n, string memory s) ERC20(n, s) {}

    function rebase(uint256 newIndex) external {
        index = newIndex;
    }

    function mint(address to, uint256 shownAmount) external {
        _mint(to, (shownAmount * 1e18) / index);
    }

    function balanceOf(address a) public view override returns (uint256) {
        return (super.balanceOf(a) * index) / 1e18;
    }

    function totalSupply() public view override returns (uint256) {
        return (super.totalSupply() * index) / 1e18;
    }

    function _update(address from, address to, uint256 shown) internal override {
        super._update(from, to, (shown * 1e18) / index);
    }
}

/// ERC-8056-like stand-in: raw balances never move, uiMultiplier() rises with each reinvested dividend. Local only.
contract MockScaledStock is ERC20 {
    uint256 public uiMultiplier = 1e18;

    constructor(string memory n, string memory s) ERC20(n, s) {}

    function setMultiplier(uint256 m) external {
        uiMultiplier = m;
    }

    function mint(address to, uint256 raw) external {
        _mint(to, raw);
    }
}

/// Takes 1% of every transfer: a series must refuse it on split.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, address(0xdead), cut);
            super._update(from, to, value - cut);
        } else {
            super._update(from, to, value);
        }
    }
}
