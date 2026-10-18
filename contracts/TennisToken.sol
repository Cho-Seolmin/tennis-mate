// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Tennis Token is a Sepolia honor token. It has no commercial value.
contract TennisToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Tennis Token", "TNS") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
