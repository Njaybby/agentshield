// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {QuerySettlement} from "../src/QuerySettlement.sol";

/// forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
/// Env: DEPLOYER_PRIVATE_KEY (required), TREASURY_ADDRESS (optional, defaults to deployer).
contract Deploy is Script {
    uint256 constant MIN_STAKE = 0.0001 ether;
    uint256 constant MAX_WEIGHT_STAKE = 0.01 ether;
    uint256 constant QUERY_PRICE = 0.00001 ether;

    function run() external returns (ReputationRegistry reg, QuerySettlement qs) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        vm.startBroadcast(pk);
        reg = new ReputationRegistry(MIN_STAKE, MAX_WEIGHT_STAKE);
        qs = new QuerySettlement(treasury, QUERY_PRICE);

        reg.stake{value: MIN_STAKE}();
        uint8 critical = reg.SEVERITY_CRITICAL();
        reg.publishIOC(
            0x111111111111111111111111111111111111dEAD,
            ReputationRegistry.Category.HONEYPOT,
            critical,
            "SAFE2MOON honeypot, sells revert"
        );
        reg.publishIOC(
            0x333333333333333333333333333333333333cafe,
            ReputationRegistry.Category.DRAINER,
            critical,
            "Permit2 phantom spender"
        );
        reg.publishIOC(
            0x444444444444444444444444444444444444FadE,
            ReputationRegistry.Category.DRAINER,
            critical,
            "AgentWallet interceptor"
        );
        vm.stopBroadcast();

        console2.log("ReputationRegistry:", address(reg));
        console2.log("QuerySettlement:", address(qs));
        console2.log("IOCs seeded:", reg.iocCount());
    }
}
