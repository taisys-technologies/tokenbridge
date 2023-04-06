
# Bridge construction

This file includes how to deploy bridge contracts and how to run the corresponding oracle. The bridge allows users to lock existing ERC20 token in one chain(foreign) and mint the same amount of ERC677(ERC20 compatible) token in another(home). Or burning ERC677 for releasing ERC20 on the other hand.
The structure of the bridge with oracles will be like:
![](https://i.imgur.com/FXEBpUj.png)

## Overview

The POA TokenBridge allows users to transfer assets between two chains in the Ethereum ecosystem. It is composed of several elements which are contained within this monorepository.

For a complete picture of the POA TokenBridge functionality, it is useful to explore each subrepository.

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

## Available deployments

| **Launched by POA** | **Launched by 3rd parties** |
| ---------- | ---------- |
| [POA20 Bridge](https://bridge.poa.net/) | [Ocean TokenBridge](https://bridge.oceanprotocol.com/) | 
| [xDai Bridge](https://dai-bridge.poa.network/) | [Thunder bridge](https://ui.stormdapps.com/) |
| [WETC Bridge](https://wetc.app/) | [Volta TokenBridge](https://vt.volta.bridge.eth.events/) & [DAI bridge to Volta Chain](https://dai.volta.bridge.eth.events/) |
| | [Artis Brige](https://bridge.artis.network/) |
| | [Tenda bridge](https://bridge-mainnet.tenda.network) & [xDai-to-Tenda bridge](https://bridge-xdai.tenda.network/) |

## Network Definitions

 Bridging occurs between two networks.

 * **Home** - or **Native** - is a network with fast and inexpensive operations. All bridge operations to collect validator confirmations are performed on this side of the bridge.

* **Foreign** can be any chain; generally it refers to the Ethereum mainnet. 

## Operational Modes

The POA TokenBridge provides four operational modes:

- [x] `ERC20-to-Native`: Pre-existing **tokens** in the Foreign network are locked and **coins** are minted in the `Home` network. In this mode, the Home network consensus engine invokes [Parity's Block Reward contract](https://wiki.parity.io/Block-Reward-Contract.html) to mint coins per the bridge contract request. **More Information: [xDai Chain](https://medium.com/poa-network/poa-network-partners-with-makerdao-on-xdai-chain-the-first-ever-usd-stable-blockchain-65a078c41e6a)**
- [x] `Arbitrary-Message`: Transfer arbitrary data between two networks as so the data could be interpreted as an arbitrary contract method invocation.

## Initializing the monorepository

Clone the repository:
```bash
git clone https://github.com/poanetwork/tokenbridge
```

If there is no need to build docker images for the TokenBridge components (oracle, monitor), initialize submodules, install dependencies, compile the Smart Contracts:

```
git clone git@github.com:taisys-technologies/taisys-bridge.git
cd taisys-bridge
yarn initialize
```

## Deploy Arbituary Message Bridge(AMB) bridge contracts

AMB bridge contracts are deployed on both chains to interact with oracle to verify messages crossing chains. 
* Use `.env.amb` as template for `.env`, more details [here](https://github.com/taisys-technologies/taisys-bridge/blob/master/CONFIGURATION.md). 
* Put the chain with ERC20 contract as `foreign chain`.
* Double check keys, addresses, rpc urls and **gasPrice** in `.env`.
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

## Deploy mediator contracts
Mediator contracts lock/release/burn/mint tokens when they receive verified message from AMB bridge contracts. With the home and foreign AMB bridges deployed, 
* Renew `.env` file with the template, `.env.ambe2e`. Put addresses of new bridge contracts into the new `.env` file.
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

## Start oracle
Oracle is in charge of verifying and forwarding messages between two chains. 
* Put AMB bridge contract addresses and block heights in the `.env` file. 
* For the oracle to fix its gasPrice automatically, `COMMON_FOREIGN_GAS_PRICE_SUPPLIER_URL` needs to be assigned with RPC URL such as `https://goerli.infura.io/v3/your-infura-project-id`.
* As the gas price returned will be in Wei, `COMMON_FOREIGN_GAS_PRICE_FACTOR` need to be `desired_factor * 1e-9`.
* Put addresses of both mediator contracts into `oracle/bridge_data/access-lists/allowance_list.txt`.
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

# Usage
About how to use the bridge.
## Smart Contracts3.eth.get_transaction_count(addr)

User
* ERC677 
    * TransferAndCall \*transaction
* ERC20
    * Approve \*transaction
* Foreign Mediator
    * RelayTokens \*transaction
___
Admin
* Home Bridge
    * submitSignatures \*transaction
    * executeAffirmation \*transaction
* Home/Foreign Validator
    *  addValidator \*transaction
    *  removeValidator \*transaction
* Foreign Bridge
    * executeSignatures \*transaction
### TransferAndCall
* Format: `transferAndCall(address _to, uint256 _value, bytes _data)`
* Output: True if succeed.
* Event: (list internal function events?)
    * `Tranfer(msg.sender, _to, _value, _data)``
### Approve
skip
### RelayTokens
* Format: `function relayTokens(address _receiver, uint256 _value)`
* Output: void
### addValidator
* Format: `function addValidator(address _validator) onlyOwner`
* Output: void
    * Event: ValidatorAdded(_validator)
### removeValidator
* Format: `function addValidator(address _validator) onlyOwner`
* Output: void
    * Event: ValidatorRomoved(_validator)

## Backend Integration
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
## Deployments

Between Goerli(foreign) and `https://lab-rpc.taisys.dev` (home).
```
MyToken deployed to: 0x94E2994B7f8bcd1aFD7bD230A1859B2BFFAe92D6

[   Home  ] HomeBridge: 0xbaefC73611b584a1DDb1b09b237AC6eD4F790EB6 at block 52234
[ Foreign ] ForeignBridge: 0xF127350e4D96a9a5e7aA4EBdd6CC8a44ba510E03 at block 8744559
Contracts Deployment have been saved to `bridgeDeploymentResults.json`
{
    "homeBridge": {
        "address": "0xbaefC73611b584a1DDb1b09b237AC6eD4F790EB6",
        "deployedBlockNumber": 52234
    },
    "foreignBridge": {
        "address": "0xF127350e4D96a9a5e7aA4EBdd6CC8a44ba510E03",
        "deployedBlockNumber": 8744559
    }
}


[   Home  ] Bridge Mediator: 0x0974315d3D6CAFd70e3DB8577d20f0eBDF8e06fF
[   Home  ] ERC677 Bridgeable Token: 0x5Cc3D0803F8c9a7D1F080eC22E819695AF91BC1E
[ Foreign ] Bridge Mediator: 0xD6569a76B6Fec1d49F62351854E25f8B55E6514a
[ Foreign ] ERC677 Token: 0x94E2994B7f8bcd1aFD7bD230A1859B2BFFAe92D6
Contracts Deployment have been saved to `bridgeDeploymentResults.json`
{
    "homeBridge": {
        "homeBridgeMediator": {
            "address": "0x0974315d3D6CAFd70e3DB8577d20f0eBDF8e06fF"
        },
        "bridgeableErc677": {
            "address": "0x5Cc3D0803F8c9a7D1F080eC22E819695AF91BC1E"
        }
    },
    "foreignBridge": {
        "foreignBridgeMediator": {
            "address": "0xD6569a76B6Fec1d49F62351854E25f8B55E6514a"
        }
    }
}

```
