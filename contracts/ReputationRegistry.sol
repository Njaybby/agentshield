// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReputationRegistry
 * @notice Sybil-resistant contributor reputation for CTI submissions.
 *         Complements ERC-8004: stake-weighted attestations, not free reviews.
 * @dev Hackathon scaffold — pair with OKB staking on X Layer for real Sybil cost.
 */
contract ReputationRegistry {
    struct Contributor {
        uint256 stake;
        uint256 score;
        uint256 reports;
        bool banned;
    }

    address public owner;
    mapping(address => Contributor) public contributors;
    mapping(bytes32 => address) public iocPublisher; // iocId => publisher

    event Staked(address indexed who, uint256 amount);
    event IOCPublished(bytes32 indexed iocId, address indexed publisher, bytes32 uriHash);
    event Attested(bytes32 indexed iocId, address indexed attester, int256 delta);
    event Banned(address indexed who);

    error NotOwner();
    error BannedContributor();
    error InsufficientStake();
    error UnknownIOC();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function stake() external payable {
        if (contributors[msg.sender].banned) revert BannedContributor();
        contributors[msg.sender].stake += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function publishIOC(bytes32 iocId, bytes32 uriHash) external {
        Contributor storage c = contributors[msg.sender];
        if (c.banned) revert BannedContributor();
        if (c.stake < 0.01 ether) revert InsufficientStake();
        iocPublisher[iocId] = msg.sender;
        c.reports += 1;
        emit IOCPublished(iocId, msg.sender, uriHash);
    }

    function attest(bytes32 iocId, int256 delta) external {
        if (iocPublisher[iocId] == address(0)) revert UnknownIOC();
        Contributor storage c = contributors[msg.sender];
        if (c.banned) revert BannedContributor();
        if (c.stake < 0.01 ether) revert InsufficientStake();
        address pub = iocPublisher[iocId];
        if (delta >= 0) {
            contributors[pub].score += uint256(delta);
        } else {
            uint256 d = uint256(-delta);
            if (contributors[pub].score > d) contributors[pub].score -= d;
            else contributors[pub].score = 0;
        }
        emit Attested(iocId, msg.sender, delta);
    }

    function ban(address who) external onlyOwner {
        contributors[who].banned = true;
        emit Banned(who);
    }
}
