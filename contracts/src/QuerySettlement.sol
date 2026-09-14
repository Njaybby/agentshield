// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title QuerySettlement
 * @notice Minimal x402-style pay-per-query settlement for AgentShield CTI lookups.
 *         A payer (agent or facilitator) settles exactly `priceWei` per query; any
 *         excess `msg.value` is refunded in the same transaction.
 * @dev Each `payId` can be settled once (replay protection for x402 receipts).
 */
contract QuerySettlement {
    address public owner;
    address public treasury;
    uint256 public priceWei;
    mapping(bytes32 => bool) public settled; // payId => used

    event QuerySettled(bytes32 indexed payId, address indexed payer, uint256 amount, bytes32 indexed queryHash);
    event PriceUpdated(uint256 priceWei);
    event TreasuryUpdated(address treasury);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error AlreadySettled();
    error Underpaid();
    error ZeroAddress();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address treasury_, uint256 priceWei_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        owner = msg.sender;
        treasury = treasury_;
        priceWei = priceWei_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Pay for one query. Charges exactly `priceWei`, refunds the excess.
    function settle(bytes32 payId, bytes32 queryHash) external payable {
        if (settled[payId]) revert AlreadySettled();
        uint256 price = priceWei;
        if (msg.value < price) revert Underpaid();
        settled[payId] = true; // effects before interactions

        if (price > 0) _send(treasury, price);
        uint256 excess = msg.value - price;
        if (excess > 0) _send(msg.sender, excess);

        emit QuerySettled(payId, msg.sender, price, queryHash);
    }

    function setPrice(uint256 priceWei_) external onlyOwner {
        priceWei = priceWei_;
        emit PriceUpdated(priceWei_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
