// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title QuerySettlement
 * @notice Minimal x402-style pay-per-query settlement for AgentShield CTI lookups.
 *         Agents (or facilitators) settle micropayments per shield check / IOC query.
 * @dev Hackathon scaffold — wire to X Layer zero-gas x402 facilitator in production.
 */
contract QuerySettlement {
    address public owner;
    address public treasury;
    uint256 public priceWei;
    mapping(bytes32 => bool) public settled; // payId => used

    event PriceUpdated(uint256 priceWei);
    event QueryPaid(
        bytes32 indexed payId,
        address indexed payer,
        bytes32 indexed queryHash,
        uint256 amount
    );

    error NotOwner();
    error AlreadySettled();
    error InvalidPayment();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_, uint256 priceWei_) {
        owner = msg.sender;
        treasury = treasury_;
        priceWei = priceWei_;
    }

    function setPrice(uint256 priceWei_) external onlyOwner {
        priceWei = priceWei_;
        emit PriceUpdated(priceWei_);
    }

    function settle(bytes32 payId, bytes32 queryHash) external payable {
        if (settled[payId]) revert AlreadySettled();
        if (msg.value < priceWei) revert InvalidPayment();
        settled[payId] = true;
        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "treasury transfer failed");
        emit QueryPaid(payId, msg.sender, queryHash, msg.value);
    }
}
