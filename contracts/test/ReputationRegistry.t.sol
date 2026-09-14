// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    ReputationRegistry reg;
    uint256 constant MIN = 0.0001 ether;
    uint256 constant CAP = 0.01 ether;

    address pub = makeAddr("publisher");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address whale = makeAddr("whale");
    address target = address(0xdEaD);

    function setUp() public {
        reg = new ReputationRegistry(MIN, CAP);
        _fundStake(pub, MIN);
        _fundStake(alice, 0.001 ether);
        _fundStake(bob, 0.003 ether);
        _fundStake(whale, 10 ether);
    }

    function _fundStake(address who, uint256 amt) internal {
        vm.deal(who, amt + 1 ether);
        vm.prank(who);
        reg.stake{value: amt}();
    }

    function _publish() internal returns (uint256) {
        vm.prank(pub);
        return reg.publishIOC(target, ReputationRegistry.Category.HONEYPOT, 3, "ipfs://honeypot");
    }

    function test_PublishRequiresStake() public {
        address nobody = makeAddr("nobody");
        vm.prank(nobody);
        vm.expectRevert(ReputationRegistry.InsufficientStake.selector);
        reg.publishIOC(target, ReputationRegistry.Category.HONEYPOT, 3, "x");
    }

    function test_PublishAndLookup() public {
        uint256 id = _publish();
        assertEq(reg.iocCount(), 1);
        (bool exists, uint256 iocId, uint8 cat, uint8 sev, uint8 conf, address p, string memory uri) =
            reg.getIOCByTarget(target);
        assertTrue(exists);
        assertEq(iocId, id);
        assertEq(cat, uint8(ReputationRegistry.Category.HONEYPOT));
        assertEq(sev, 3);
        assertEq(conf, 100); // only publisher's stake so far
        assertEq(p, pub);
        assertEq(uri, "ipfs://honeypot");

        ReputationRegistry.IOC memory ioc = reg.getIOC(id);
        assertEq(ioc.target, target);
        assertEq(ioc.supportWeight, MIN);

        (exists,,,,,,) = reg.getIOCByTarget(address(0xBEEF));
        assertFalse(exists);
    }

    function test_DuplicateTargetReverts() public {
        _publish();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.TargetAlreadyReported.selector, 0));
        reg.publishIOC(target, ReputationRegistry.Category.DRAINER, 2, "dup");
    }

    function test_RevertSelfAttestation() public {
        uint256 id = _publish();
        vm.prank(pub);
        vm.expectRevert(ReputationRegistry.SelfAttestation.selector);
        reg.attest(id, true);
    }

    function test_RevertDoubleAttestation() public {
        uint256 id = _publish();
        vm.startPrank(alice);
        reg.attest(id, true);
        vm.expectRevert(ReputationRegistry.AlreadyAttested.selector);
        reg.attest(id, true);
        vm.stopPrank();
        (,, int256 rep,,) = _contributor(pub);
        assertEq(rep, int256(0.001 ether)); // counted once
    }

    function test_AttestRequiresStake() public {
        uint256 id = _publish();
        address nobody = makeAddr("nobody");
        vm.prank(nobody);
        vm.expectRevert(ReputationRegistry.InsufficientStake.selector);
        reg.attest(id, true);
    }

    function test_StakeWeightedConfidence() public {
        uint256 id = _publish(); // support = 0.0001
        vm.prank(alice);
        reg.attest(id, true); // support += 0.001 -> 0.0011
        vm.prank(bob);
        reg.attest(id, false); // dispute = 0.003
        // 0.0011 * 100 / 0.0041 = 26
        assertEq(reg.confidenceOf(id), 26);
        (,, int256 rep,,) = _contributor(pub);
        assertEq(rep, int256(0.001 ether) - int256(0.003 ether));
    }

    function test_WeightCappedForWhale() public {
        uint256 id = _publish();
        vm.prank(whale);
        reg.attest(id, false);
        ReputationRegistry.IOC memory ioc = reg.getIOC(id);
        assertEq(ioc.disputeWeight, CAP);
    }

    function test_RevokeAttestationRestoresAndBlocksRecast() public {
        uint256 id = _publish();
        vm.startPrank(bob);
        reg.attest(id, false);
        reg.revokeAttestation(id);
        assertEq(reg.confidenceOf(id), 100);
        vm.expectRevert(ReputationRegistry.AlreadyAttested.selector);
        reg.attest(id, false);
        vm.stopPrank();
        (,, int256 rep,,) = _contributor(pub);
        assertEq(rep, 0);
    }

    function test_BannedCannotAct() public {
        uint256 id = _publish();
        reg.ban(alice);
        vm.prank(alice);
        vm.expectRevert(ReputationRegistry.BannedContributor.selector);
        reg.attest(id, true);
    }

    function test_UnstakeCooldown() public {
        uint256 before = alice.balance;
        vm.startPrank(alice);
        reg.requestUnstake(0.001 ether);
        // stake leaves active balance immediately -> cannot attest while pending
        uint256 id;
        vm.stopPrank();
        id = _publish();
        vm.prank(alice);
        vm.expectRevert(ReputationRegistry.InsufficientStake.selector);
        reg.attest(id, true);

        vm.prank(alice);
        vm.expectRevert(ReputationRegistry.CooldownActive.selector);
        reg.withdraw();

        vm.warp(block.timestamp + reg.WITHDRAW_COOLDOWN());
        vm.prank(alice);
        reg.withdraw();
        assertEq(alice.balance, before + 0.001 ether);
    }

    function _contributor(address who) internal view returns (uint256, uint256, int256, uint32, bool) {
        (uint256 s, uint256 pending,, int256 rep, uint32 n, bool banned) = reg.contributors(who);
        return (s, pending, rep, n, banned);
    }
}
