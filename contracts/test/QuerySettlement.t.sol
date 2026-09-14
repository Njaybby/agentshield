// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {QuerySettlement} from "../src/QuerySettlement.sol";

contract QuerySettlementTest is Test {
    event QuerySettled(bytes32 indexed payId, address indexed payer, uint256 amount, bytes32 indexed queryHash);

    QuerySettlement qs;
    address treasury = makeAddr("treasury");
    address payer = makeAddr("payer");
    uint256 constant PRICE = 0.001 ether;

    function setUp() public {
        qs = new QuerySettlement(treasury, PRICE);
        vm.deal(payer, 1 ether);
    }

    function test_SettleExactPrice() public {
        vm.expectEmit(address(qs));
        emit QuerySettled("p1", payer, PRICE, "q1");
        vm.prank(payer);
        qs.settle{value: PRICE}("p1", "q1");
        assertEq(treasury.balance, PRICE);
        assertTrue(qs.settled("p1"));
    }

    function test_OverpaymentRefunded() public {
        vm.prank(payer);
        qs.settle{value: 0.5 ether}("p1", "q1");
        assertEq(treasury.balance, PRICE);
        assertEq(payer.balance, 1 ether - PRICE);
        assertEq(address(qs).balance, 0);
    }

    function test_RevertUnderpaid() public {
        vm.prank(payer);
        vm.expectRevert(QuerySettlement.Underpaid.selector);
        qs.settle{value: PRICE - 1}("p1", "q1");
    }

    function test_RevertDuplicatePayId() public {
        vm.startPrank(payer);
        qs.settle{value: PRICE}("p1", "q1");
        vm.expectRevert(QuerySettlement.AlreadySettled.selector);
        qs.settle{value: PRICE}("p1", "q2");
        vm.stopPrank();
    }

    function test_OwnerAdmin() public {
        address t2 = makeAddr("t2");
        qs.setPrice(2 wei);
        qs.setTreasury(t2);
        assertEq(qs.priceWei(), 2);
        assertEq(qs.treasury(), t2);

        vm.startPrank(payer);
        vm.expectRevert(QuerySettlement.NotOwner.selector);
        qs.setPrice(0);
        vm.expectRevert(QuerySettlement.NotOwner.selector);
        qs.setTreasury(payer);
        vm.stopPrank();

        vm.expectRevert(QuerySettlement.ZeroAddress.selector);
        qs.setTreasury(address(0));
    }
}
