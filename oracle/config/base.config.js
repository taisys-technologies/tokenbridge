require('../env')

const {
  BRIDGE_MODES,
  HOME_ERC_TO_NATIVE_ABI,
  FOREIGN_ERC_TO_NATIVE_ABI,
  HOME_AMB_ABI,
  FOREIGN_AMB_ABI
} = require('../../commons')
const {
  web3Home,
  web3Foreign,
  web3HomeRedundant,
  web3HomeFallback,
  web3ForeignRedundant,
  web3ForeignFallback,
  web3ForeignArchive
} = require('../src/services/web3')

const {
  ORACLE_BRIDGE_MODE,
  ORACLE_MAX_PROCESSING_TIME,
  COMMON_HOME_BRIDGE_ADDRESS,
  COMMON_FOREIGN_BRIDGE_ADDRESS,
  ORACLE_HOME_RPC_POLLING_INTERVAL,
  ORACLE_FOREIGN_RPC_POLLING_INTERVAL,
  ORACLE_HOME_START_BLOCK,
  ORACLE_FOREIGN_START_BLOCK,
  ORACLE_HOME_RPC_BLOCK_POLLING_LIMIT,
  ORACLE_FOREIGN_RPC_BLOCK_POLLING_LIMIT,
  ORACLE_HOME_EVENTS_REPROCESSING,
  ORACLE_HOME_EVENTS_REPROCESSING_BATCH_SIZE,
  ORACLE_HOME_EVENTS_REPROCESSING_BLOCK_DELAY,
  ORACLE_HOME_RPC_SYNC_STATE_CHECK_INTERVAL,
  ORACLE_FOREIGN_EVENTS_REPROCESSING,
  ORACLE_FOREIGN_EVENTS_REPROCESSING_BATCH_SIZE,
  ORACLE_FOREIGN_EVENTS_REPROCESSING_BLOCK_DELAY,
  ORACLE_FOREIGN_RPC_SYNC_STATE_CHECK_INTERVAL
} = process.env

let homeAbi
let foreignAbi
let id

switch (ORACLE_BRIDGE_MODE) {
  case BRIDGE_MODES.ERC_TO_NATIVE:
    homeAbi = HOME_ERC_TO_NATIVE_ABI
    foreignAbi = FOREIGN_ERC_TO_NATIVE_ABI
    id = 'erc-native'
    break
  case BRIDGE_MODES.ARBITRARY_MESSAGE:
    homeAbi = HOME_AMB_ABI
    foreignAbi = FOREIGN_AMB_ABI
    id = 'amb'
    break
  default:
    if (process.env.NODE_ENV !== 'test') {
      throw new Error(`Bridge Mode: ${ORACLE_BRIDGE_MODE} not supported.`)
    } else {
      homeAbi = HOME_ERC_TO_NATIVE_ABI
      foreignAbi = FOREIGN_ERC_TO_NATIVE_ABI
      id = 'erc-native'
    }
}

const homeContract = new web3Home.eth.Contract(homeAbi, COMMON_HOME_BRIDGE_ADDRESS)
const homeConfig = {
  chain: 'home',
  bridgeAddress: COMMON_HOME_BRIDGE_ADDRESS,
  bridgeABI: homeAbi,
  pollingInterval: parseInt(ORACLE_HOME_RPC_POLLING_INTERVAL, 10),
  syncCheckInterval: parseInt(ORACLE_HOME_RPC_SYNC_STATE_CHECK_INTERVAL, 10) || 60000,
  startBlock: parseInt(ORACLE_HOME_START_BLOCK, 10) || 0,
  blockPollingLimit: parseInt(ORACLE_HOME_RPC_BLOCK_POLLING_LIMIT, 10),
  web3: web3Home,
  web3Redundant: web3HomeRedundant,
  web3Fallback: web3HomeFallback,
  bridgeContract: homeContract,
  eventContract: homeContract,
  reprocessingOptions: {
    enabled: ORACLE_HOME_EVENTS_REPROCESSING === 'true',
    batchSize: parseInt(ORACLE_HOME_EVENTS_REPROCESSING_BATCH_SIZE, 10) || 1000,
    blockDelay: parseInt(ORACLE_HOME_EVENTS_REPROCESSING_BLOCK_DELAY, 10) || 500
  }
}

const foreignContract = new web3Foreign.eth.Contract(foreignAbi, COMMON_FOREIGN_BRIDGE_ADDRESS)
const foreignConfig = {
  chain: 'foreign',
  bridgeAddress: COMMON_FOREIGN_BRIDGE_ADDRESS,
  bridgeABI: foreignAbi,
  pollingInterval: parseInt(ORACLE_FOREIGN_RPC_POLLING_INTERVAL, 10),
  syncCheckInterval: parseInt(ORACLE_FOREIGN_RPC_SYNC_STATE_CHECK_INTERVAL, 10) || 60000,
  startBlock: parseInt(ORACLE_FOREIGN_START_BLOCK, 10) || 0,
  blockPollingLimit: parseInt(ORACLE_FOREIGN_RPC_BLOCK_POLLING_LIMIT, 10),
  web3: web3Foreign,
  web3Redundant: web3ForeignRedundant,
  web3Fallback: web3ForeignFallback,
  web3Archive: web3ForeignArchive || web3Foreign,
  bridgeContract: foreignContract,
  eventContract: foreignContract,
  reprocessingOptions: {
    enabled: ORACLE_FOREIGN_EVENTS_REPROCESSING === 'true',
    batchSize: parseInt(ORACLE_FOREIGN_EVENTS_REPROCESSING_BATCH_SIZE, 10) || 500,
    blockDelay: parseInt(ORACLE_FOREIGN_EVENTS_REPROCESSING_BLOCK_DELAY, 10) || 250
  }
}

const maxProcessingTime =
  parseInt(ORACLE_MAX_PROCESSING_TIME, 10) || 4 * Math.max(homeConfig.pollingInterval, foreignConfig.pollingInterval)

module.exports = {
  eventFilter: {},
  maxProcessingTime,
  shutdownKey: 'oracle-shutdown',
  home: homeConfig,
  foreign: foreignConfig,
  id
}
