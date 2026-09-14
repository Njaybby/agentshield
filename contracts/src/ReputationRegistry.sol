// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReputationRegistry
 * @notice Stake-gated IOC (indicator of compromise) registry with stake-weighted
 *         attestations and contributor reputation for AgentShield.
 *
 *         ERC-8004-inspired (Reputation Registry semantics: feedback from a client,
 *         no self-feedback, revocable feedback, `NewFeedback` / `FeedbackRevoked`
 *         events). This is NOT a full ERC-8004 implementation: there is no Identity
 *         Registry / agentId, and feedback targets an IOC rather than an agent.
 *
 * Weighting formula
 *   weight(attester) = min(stake(attester), maxWeightStake)     [snapshotted at attest time]
 *   supportWeight    = min(stake(publisher), maxWeightStake) + sum(weight of supporting attesters)
 *   disputeWeight    = sum(weight of disputing attesters)
 *   confidence       = supportWeight * 100 / (supportWeight + disputeWeight)   (0..100)
 *   reputation(pub)  += weight on support, -= weight on dispute
 *
 * Sybil cost: every identity must lock >= minStake, and weight is linear in stake
 * below the cap, so splitting stake across identities gives no extra weight. The cap
 * bounds single-whale dominance (a whale must split into capped identities, each
 * paying its own stake). This is economic Sybil *cost*, not Sybil-proofness.
 */
contract ReputationRegistry {
    enum Category {
        HONEYPOT,
        DRAINER,
        PROMPT_INJECTION,
        PHISHING,
        SYBIL
    }

    /// Severity: 0 LOW, 1 MEDIUM, 2 HIGH, 3 CRITICAL
    uint8 public constant SEVERITY_CRITICAL = 3;
    uint256 public constant WITHDRAW_COOLDOWN = 1 days;

    struct IOC {
        address target;
        Category category;
        uint8 severity;
        address publisher;
        uint64 createdAt;
        uint32 attestationCount;
        uint256 supportWeight;
        uint256 disputeWeight;
        string uri;
    }

    struct Contributor {
        uint256 stake;
        uint256 pendingWithdrawal;
        uint64 unlockAt;
        int256 reputation;
        uint32 iocsPublished;
        bool banned;
    }

    struct Attestation {
        bool exists;
        bool revoked;
        bool support;
        uint256 weight;
    }

    address public owner;
    uint256 public immutable minStake;
    uint256 public immutable maxWeightStake;

    IOC[] private _iocs;
    mapping(address => uint256) private _iocIdPlusOne; // target => iocId + 1 (0 = none)
    mapping(address => Contributor) public contributors;
    mapping(uint256 => mapping(address => Attestation)) public attestations; // iocId => attester => attestation

    event Staked(address indexed who, uint256 amount, uint256 totalStake);
    event UnstakeRequested(address indexed who, uint256 amount, uint64 unlockAt);
    event Withdrawn(address indexed who, uint256 amount);
    event IOCPublished(
        uint256 indexed iocId, address indexed target, address indexed publisher, Category category, uint8 severity, string uri
    );
    /// ERC-8004-style: value is +1 (support) or -1 (disputes); weight is stake-derived.
    event NewFeedback(uint256 indexed iocId, address indexed clientAddress, int8 value, uint256 weight);
    event FeedbackRevoked(uint256 indexed iocId, address indexed clientAddress);
    event Banned(address indexed who);

    error NotOwner();
    error BannedContributor();
    error InsufficientStake();
    error UnknownIOC();
    error TargetAlreadyReported(uint256 iocId);
    error InvalidSeverity();
    error ZeroAddress();
    error SelfAttestation();
    error AlreadyAttested();
    error NoAttestation();
    error CooldownActive();
    error NothingToWithdraw();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyStaked() {
        Contributor storage c = contributors[msg.sender];
        if (c.banned) revert BannedContributor();
        if (c.stake < minStake) revert InsufficientStake();
        _;
    }

    constructor(uint256 minStake_, uint256 maxWeightStake_) {
        require(minStake_ > 0 && maxWeightStake_ >= minStake_, "bad stake params");
        owner = msg.sender;
        minStake = minStake_;
        maxWeightStake = maxWeightStake_;
    }

    // ---------------------------------------------------------------- staking

    function stake() external payable {
        Contributor storage c = contributors[msg.sender];
        if (c.banned) revert BannedContributor();
        c.stake += msg.value;
        emit Staked(msg.sender, msg.value, c.stake);
    }

    /// @notice Move `amount` out of active stake immediately; claimable after the cooldown.
    ///         Requesting again adds to the pending amount and restarts the cooldown.
    function requestUnstake(uint256 amount) external {
        Contributor storage c = contributors[msg.sender];
        if (amount == 0 || amount > c.stake) revert NothingToWithdraw();
        c.stake -= amount;
        c.pendingWithdrawal += amount;
        c.unlockAt = uint64(block.timestamp + WITHDRAW_COOLDOWN);
        emit UnstakeRequested(msg.sender, amount, c.unlockAt);
    }

    function withdraw() external {
        Contributor storage c = contributors[msg.sender];
        uint256 amount = c.pendingWithdrawal;
        if (amount == 0) revert NothingToWithdraw();
        if (block.timestamp < c.unlockAt) revert CooldownActive();
        c.pendingWithdrawal = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    // -------------------------------------------------------------- publishing

    function publishIOC(address target, Category category, uint8 severity, string calldata uri)
        external
        onlyStaked
        returns (uint256 iocId)
    {
        if (target == address(0)) revert ZeroAddress();
        if (severity > SEVERITY_CRITICAL) revert InvalidSeverity();
        if (_iocIdPlusOne[target] != 0) revert TargetAlreadyReported(_iocIdPlusOne[target] - 1);

        iocId = _iocs.length;
        _iocs.push(
            IOC({
                target: target,
                category: category,
                severity: severity,
                publisher: msg.sender,
                createdAt: uint64(block.timestamp),
                attestationCount: 0,
                supportWeight: _weight(msg.sender),
                disputeWeight: 0,
                uri: uri
            })
        );
        _iocIdPlusOne[target] = iocId + 1;
        contributors[msg.sender].iocsPublished += 1;
        emit IOCPublished(iocId, target, msg.sender, category, severity, uri);
    }

    // ------------------------------------------------------------ attestations

    /// @notice Support (true) or dispute (false) an IOC. One attestation per (attester, iocId),
    ///         publisher cannot attest their own IOC.
    function attest(uint256 iocId, bool support) external onlyStaked {
        if (iocId >= _iocs.length) revert UnknownIOC();
        IOC storage ioc = _iocs[iocId];
        if (ioc.publisher == msg.sender) revert SelfAttestation();
        Attestation storage a = attestations[iocId][msg.sender];
        if (a.exists) revert AlreadyAttested(); // revoked attestations cannot be re-cast

        uint256 w = _weight(msg.sender);
        attestations[iocId][msg.sender] = Attestation({exists: true, revoked: false, support: support, weight: w});
        ioc.attestationCount += 1;
        Contributor storage pub = contributors[ioc.publisher];
        if (support) {
            ioc.supportWeight += w;
            pub.reputation += int256(w);
        } else {
            ioc.disputeWeight += w;
            pub.reputation -= int256(w);
        }
        emit NewFeedback(iocId, msg.sender, support ? int8(1) : int8(-1), w);
    }

    /// @notice Revoke your attestation; its weight is removed from the IOC and publisher reputation.
    function revokeAttestation(uint256 iocId) external {
        Attestation storage a = attestations[iocId][msg.sender];
        if (!a.exists || a.revoked) revert NoAttestation();
        a.revoked = true;
        IOC storage ioc = _iocs[iocId];
        ioc.attestationCount -= 1;
        Contributor storage pub = contributors[ioc.publisher];
        if (a.support) {
            ioc.supportWeight -= a.weight;
            pub.reputation -= int256(a.weight);
        } else {
            ioc.disputeWeight -= a.weight;
            pub.reputation += int256(a.weight);
        }
        emit FeedbackRevoked(iocId, msg.sender);
    }

    function ban(address who) external onlyOwner {
        contributors[who].banned = true;
        emit Banned(who);
    }

    // ------------------------------------------------------------------- views

    function iocCount() external view returns (uint256) {
        return _iocs.length;
    }

    function getIOC(uint256 iocId) external view returns (IOC memory) {
        if (iocId >= _iocs.length) revert UnknownIOC();
        return _iocs[iocId];
    }

    /// @notice Cheap lookup for the off-chain shield agent. confidence is 0..100.
    function getIOCByTarget(address target)
        external
        view
        returns (
            bool exists,
            uint256 iocId,
            uint8 category,
            uint8 severity,
            uint8 confidence,
            address publisher,
            string memory uri
        )
    {
        uint256 idp1 = _iocIdPlusOne[target];
        if (idp1 == 0) return (false, 0, 0, 0, 0, address(0), "");
        iocId = idp1 - 1;
        IOC storage ioc = _iocs[iocId];
        return (true, iocId, uint8(ioc.category), ioc.severity, _confidence(ioc), ioc.publisher, ioc.uri);
    }

    function confidenceOf(uint256 iocId) external view returns (uint8) {
        if (iocId >= _iocs.length) revert UnknownIOC();
        return _confidence(_iocs[iocId]);
    }

    function _confidence(IOC storage ioc) private view returns (uint8) {
        uint256 total = ioc.supportWeight + ioc.disputeWeight;
        if (total == 0) return 0;
        return uint8((ioc.supportWeight * 100) / total);
    }

    function _weight(address who) private view returns (uint256) {
        uint256 s = contributors[who].stake;
        return s < maxWeightStake ? s : maxWeightStake;
    }
}
