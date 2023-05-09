
# TokenBridge

TokenBridge is able to bridge user-defined erc20 token on one chain to another. On each side of the bridge is a chain, each chain contains a bridge contract, a validator contract, a mediator contract, and a token contract.

To build a bridge, we'll need a an existing(customized) ERC20 token on the desired chain (foreign chain) (public chains are preferable to be the foreign chain). The deployment process in the next section includes deploying both validator contracts, bridge contracts, and mediator contracts on both side along with the token contract, which is ERC677 contract, on the other chain (home chain).

With contracts deployed, starts oracles (act like multisignature) to relay message through the bridge.

In the following picture, the big left square is the foreign chain while the right one is the homechain. The smaller squares in the big squares are smart contracts. Other componenets will be explained in later sections.

![](https://i.imgur.com/FXEBpUj.png)

## Structure

Sub-repositories maintained within this monorepo are listed below.

| Sub-repository | Description |
| --- | --- |
| [Oracle](oracle/README.md) | Responsible for listening to bridge related events and authorizing asset transfers. |
| [Monitor](monitor/README.md) | Tool for checking balances and unprocessed events in bridged networks. |
| [Deployment](deployment/README.md) | Ansible playbooks for deploying cross-chain bridges. |
| [Oracle-E2E](oracle-e2e/README.md) | End to end tests for the Oracle |
| [Monitor-E2E](monitor-e2e/README.md) | End to end tests for the Monitor |
| [Deployment-E2E](deployment-e2e/README.md) | End to end tests for the Deployment |
| [Commons](commons/README.md) | Interfaces, constants and utilities shared between the sub-repositories |
| [E2E-Commons](e2e-commons/README.md) | Common utilities and configuration used in end to end tests |
| [ALM](alm/README.md) | DApp interface tool for AMB Live Monitoring |
| [Burner-wallet-plugin](burner-wallet-plugin/README.md) | TokenBridge Burner Wallet 2 Plugin |

Additionally there are [Smart Contracts](https://github.com/poanetwork/tokenbridge-contracts) used to manage bridge validators, collect signatures, and confirm asset relay and disposal.

## Bridge Construction
This section demonstrates how to deploy bridge contracts and how to run the corresponding oracle. Before running any scripts, a target ERC20 contract address which would be exchanged to another chain should be ready.

In our settings, contracts deployed are:
* foreign
  * bridge: `ForeignAMB.sol`
  * validator: `BridgeValidators.sol`
  * mediator: `ForeignAMBErc677ToErc677.sol`
  * token: Any ERC20 compatible contract.
* home
  * bridge: `HomeAMB.sol`
  * validator: `BridgeValidators`
  * mediator: `HomeAMBErc677ToErc677.sol`
  * token: `HomeAMBErc677ToErc677.sol`

### Deploy Arbituary Message Bridge(AMB) bridge contracts

AMB bridge contracts are deployed on both chains to interact with oracle to verify messages crossing chains. 
* Use `.env.amb` as template for `.env`, more details [here](https://github.com/taisys-technologies/taisys-bridge/blob/master/CONFIGURATION.md). 
* Put the chain with ERC20 contract address as `foreign chain`.
* Double check keys, addresses, rpc urls and **gasPrice** in `.env`. For instances:
  * `DEPLOYMENT_ACCOUNT_PRIVATE_KEY=`
  * `HOME_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/<key>`
  * `HOME_GAS_PRICE=40000000000`
```bash
cd contracts
# cp deploy/.env.amb deploy/.env
# vim deploy/.env
docker-compose up --build
docker-compose run bridge-contracts deploy.sh
```
keep the log from stdout. It is in the format below:
```
[   Home  ] HomeBridge: 0x31Ef709691B29caE64460F0bc16c98a1BBDFeF63 at block 11882086
[ Foreign ] ForeignBridge: 0x1217dD15B5962835037209564AEAE832c917686E at block 5112
Contracts Deployment have been saved to `bridgeDeploymentResults.json`
{
    "homeBridge": {
        "address": "0x31Ef709691B29caE64460F0bc16c98a1BBDFeF63",
        "deployedBlockNumber": 11882086
    },
    "foreignBridge": {
        "address": "0x1217dD15B5962835037209564AEAE832c917686E",
        "deployedBlockNumber": 5112
    }
}
```

### Deploy mediator contracts
Mediator contracts lock/release/burn/mint tokens when they receive verified message from AMB bridge contracts. With the home and foreign AMB bridges deployed, 
* Renew `.env` file with the template, `.env.ambe2e`. Put information of new bridge contracts into the new `.env` file. To name a few:
  * `HOME_BRIDGE_OWNER=0x7ACa9263555A4333F55c66d135705fEdE8fC8bF6`
  * `HOME_AMB_BRIDGE=0xd0EeaA347EDecB6b69D176008955354b6b9A9Eb5`
* Double check keys, addresses, rpc urls, and **gasPrice** in `.env`.
```bash
# cp deploy/.env.ambe2e deploy/.env
# vim deploy/.env
docker-compose up --build
docker-compose run bridge-contracts deploy.sh
```

keep the log from stdout. It is in the format below:
```
[   Home  ] Bridge Mediator: 0x9E49071ED3297575f484296c25DEa1f04C590b14
[   Home  ] ERC677 Bridgeable Token: 0x0D5360d7803EF269E8A2a7dD81d3323A2e14c160
[ Foreign ] Bridge Mediator: 0xeeDe1C632c79c0e39FCDd6948da90E463936531F
[ Foreign ] ERC677 Token: 0x8bA54E3309577be16B0C7E2973CF90d67328158c
Contracts Deployment have been saved to `bridgeDeploymentResults.json`
{
    "homeBridge": {
        "homeBridgeMediator": {
            "address": "0x9E49071ED3297575f484296c25DEa1f04C590b14"
        },
        "bridgeableErc677": {
            "address": "0x0D5360d7803EF269E8A2a7dD81d3323A2e14c160"
        }
    },
    "foreignBridge": {
        "foreignBridgeMediator": {
            "address": "0xeeDe1C632c79c0e39FCDd6948da90E463936531F"
        }
    }
}

```

### Start oracle
In the directory `oracle`, oracle is in charge of verifying and forwarding messages between two chains. Renew `.env` file with the template, `.env.example`.
* Put AMB bridge contract addresses and block heights in the `.env` file. 
  * `COMMON_HOME_BRIDGE_ADDRESS=`
  * `ORACLE_HOME_START_BLOCK=11882086`
* Put addresses of both mediator contracts into `oracle/bridge_data/access-lists/allowance_list.txt`. Addresses are simply separated by newlines as shown below.
  ```
  0xA38E358Ed15cc4cb5Bda6d199bb4930101Aff962
  0xEe74212F50cAf1B4A78901c035F87B09aA70d8Ca
  ```
* Provide address and private key of any validator provided in `.env` file when deploying bridge contracts as below.
* At least `REQUIRED_NUMBER_OF_VALIDATORS`  distinct validators need to be running to keep oracle relaying transactions.
```
cd oracle
# vim bridge_data/access-lists/allowance_list.txt
# vim .env
docker-compose -f docker-compose-build.yml build
env ORACLE_VALIDATOR_ADDRESS=0x<address> \
env ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY=<private_key> \
docker-compose up -d
```

## Oracle
Oracle is in charge of forwarding transactions between different chains.

### Allowance/Block List
Oracle automatically search for events in both chains. It than checks the addresses in `oracle/bridge_data/access-lists/allowance_list.txt` list. If the address of sender that invokes the event, or the address of mediator contract in the destination chain is in the list, the oracle will sign for that transaction.

On the contrary, sender requests will not be automatically endorsed by oracle if its address is in the `oracle/bridge_data/access-lists/block_list.txt` list.

### Validators 
Validators are initially defined in `.env` file when depolying bridge contracts. With private key to the admin account in `.env`, the following functions on validator contract can be invoked: (validator contract address can be looked up in through `validatorContract()` of the bridge contract)
* requiredSignatures
    * Format: `function requiredSignatures()
    * Input: N/A
    * Output: uint256(signatures a transaction needed to be relayed)
* setRequiredSignatures \*transaction
    * Format: function setRequiredSignatures(uint256 _requiredSignatures)
    * Input: `_requiredSignatures` of validators needed to relay message.
    * Output: void
        * Event: RequiredSignaturesChanged(_requiredSignatures)
* addValidator \*transaction
    * Format: `function addValidator(address _validator) onlyOwner`
    * Input: new validator address to be added
    * Output: void
        * Event: ValidatorAdded(_validator)
* removeValidator \*transaction
    * Format: `function removeValidator(address _validator) onlyOwner`
    * Input: validator address to be removed
    * Output: void
        * Event: ValidatorRomoved(_validator)
* validatorList
  * Format: `function validatorList()`
  * Input: void
  * Output list of validators

Note that both home and foreign chain have a validator contract attached to bridge contract. The list of validators needs to be kept identical.


## Usages
To transfer from foreign chain to home chain, users would interact with mediator contract and ERC20 contract in foreign chain (see the blue arrows from `a` to `f`); when transfering from home chain to foreign chain, users would only have to interact with ERC677(ERC20 compatible) contract in home chain (see the green arrows from `1` to `7`).

Note that foreign chain tokens are locked in foreign mediator for its home chain tokens to be minted. Reversely, home chain burnt tokens for its counterpart to be released from mediator contract address.

![](https://i.imgur.com/FXEBpUj.png)

### Bridge Foreign-to-Home
First approve ERC20 to mediator contract. Then call the mediator contract to take the approved amount and inform oracles to relay tokens.

* ERC20 at foreign
    * Approve \*transaction
* Foreign Mediator
    * RelayTokens \*transaction

### Bridge Home-to-Foreign
Call ERC677 contract to have it burn tokens and inform oracles to relay tokens.
* ERC677 at home
    * TransferAndCall \*transaction

### Function Specs.
* ERC20.approve: please refers to [here](https://github.com/taisys-technologies/taisys-blockchain-document-xsg/blob/main/contract/erc20.md#approve)
    * Input: `spender` should always be the address of foreign mediator contract.
* ForeignMediator.RelayToken
    * Format: `function relayTokens(address _receiver, uint256 _value)`
    * Input: Transfer `_value` amount of tokens(in Wei) in foreign chain to the address `_receiver` in home chain.
    * Output: void
* ERC677.TransferAndCall
    * Format: `transferAndCall(address _to, uint256 _value, bytes _data)` 
    * Input: Transfer `_value` amount of tokens(in Wei) in home chain to the address `_to` in foreign chain. Always use `0x` in entry `_data`.
    * Output: True if succeed.



### Backend Integration Sample Code
* connect to Wallet by following [this](https://github.com/taisys-technologies/taisys-blockchain-document-xsg/tree/main/market-place#%E7%92%B0%E5%A2%83%E9%A0%88%E7%9F%A5).
* sending from foreign to home(lock to mint)
```javascript
const approved = await erc20Contract.approve(
  config.foreignMediator,
  ethers.utils.parseEther(sellNGX),
);
const relayed = await foreignMediatorContract.relayTokens(
  signer.getAddress(),
  ethers.utils.parseEther(sellNGX),
);
```
* sending from home to foreign(burn to release)
```javascript
const result = await contract.transferAndCall(
  config.homeMediator,
  ethers.utils.parseEther(buyNGX),
  "0x"
);
```

### Caveats
* Foreign to home transactions are performed on foreign chain.
* Home to foreign transactions are performed on home chain.
* The transfered amount should not be less than minimum amount set in `.env` when mediator contracts are deployed.
* The daily sum of transfered amount should be less than maximum daily amount set in `.env` when mediator contracts are deployed.

