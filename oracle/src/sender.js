require('../env')
const path = require('path')
const { connectSenderToQueue } = require('./services/amqpClient')
const { redis } = require('./services/redisClient')
const GasPrice = require('./services/gasPrice')
const logger = require('./services/logger')
const { getShutdownFlag } = require('./services/shutdownState')
const { sendTx } = require('./tx/sendTx')
const { getNonce, getChainId } = require('./tx/web3')
const {
  addExtraGas,
  applyMinGasFeeBump,
  chooseGasPriceOptions,
  checkHTTPS,
  syncForEach,
  waitForFunds,
  waitForUnsuspend,
  watchdog,
  isGasPriceError,
  isSameTransactionError,
  isInsufficientBalanceError,
  isNonceError,
  loadPrivateKey,
  getValidatorAddress
} = require('./utils/utils')
const { EXIT_CODES, EXTRA_GAS_PERCENTAGE, MAX_GAS_LIMIT, MIN_GAS_PRICE_BUMP_FACTOR } = require('./utils/constants')

const { ORACLE_TX_REDUNDANCY } = process.env

if (process.argv.length < 3) {
  logger.error('Please check the number of arguments, config file was not provided')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const config = require(path.join('../config/', process.argv[2]))

const { web3, web3Fallback, syncCheckInterval } = config.main
const web3Redundant = ORACLE_TX_REDUNDANCY === 'true' ? config.main.web3Redundant : web3

const nonceKey = `${config.id}:nonce`
let chainId = 0

async function initialize() {
  try {
    const checkHttps = checkHTTPS(process.env.ORACLE_ALLOW_HTTP_FOR_RPC, logger)

    web3.currentProvider.urls.forEach(checkHttps(config.id))
    web3.currentProvider.startSyncStateChecker(syncCheckInterval)

    GasPrice.start(config.id, web3)

    chainId = await getChainId(web3)
    connectQueue()
  } catch (e) {
    logger.error(e.message)
    process.exit(EXIT_CODES.GENERAL_ERROR)
  }
}

function connectQueue() {
  connectSenderToQueue({
    queueName: config.queue,
    resendInterval: config.resendInterval,
    cb: options => {
      if (config.maxProcessingTime) {
        return watchdog(() => main(options), config.maxProcessingTime, () => {
          logger.fatal('Max processing time reached')
          process.exit(EXIT_CODES.MAX_TIME_REACHED)
        })
      }

      return main(options)
    }
  })
}

function resume(newBalance) {
  logger.info(`Validator balance changed. New balance is ${newBalance}. Resume messages processing.`)
  connectQueue()
}

function unsuspend() {
  logger.info(`Oracle sender was unsuspended.`)
  connectQueue()
}

async function readNonce(forceUpdate) {
  logger.debug('Reading nonce')
  const validatorAddress = await getValidatorAddress()
  if (forceUpdate) {
    logger.debug('Forcing update of nonce')
    return getNonce(web3, validatorAddress)
  }

  const nonce = await redis.get(nonceKey)
  if (nonce) {
    logger.debug({ nonce }, 'Nonce found in the DB')
    return Number(nonce)
  } else {
    logger.warn("Nonce wasn't found in the DB")
    return getNonce(web3, validatorAddress)
  }
}

function updateNonce(nonce) {
  if (typeof nonce !== 'number') {
    logger.warn('Given nonce value is not a valid number. Nothing will be updated in the DB.')
  } else {
    redis.set(nonceKey, nonce)
  }
}

async function main({ msg, ackMsg, nackMsg, channel, scheduleForRetry, scheduleTransactionResend }) {
  try {
    if (redis.status !== 'ready') {
      nackMsg(msg)
      return
    }

    if (await getShutdownFlag(logger, config.shutdownKey, true)) {
      logger.info('Oracle sender was suspended via the remote shutdown process')
      channel.close()
      waitForUnsuspend(() => getShutdownFlag(logger, config.shutdownKey, true), unsuspend)
      return
    }

    const txArray = JSON.parse(msg.content)
    logger.debug(`Msg received with ${txArray.length} Tx to send`)
    const gasPriceOptions = GasPrice.gasPriceOptions()

    let nonce
    let insufficientFunds = false
    let minimumBalance = null
    const failedTx = []
    const resendJobs = []

    const isResend = txArray.length > 0 && !!txArray[0].txHash

    if (isResend) {
      logger.info(`Checking status of ${txArray.length} transactions`)
      nonce = null
    } else {
      logger.info(`Sending ${txArray.length} transactions`)
      nonce = await readNonce()
    }
    await syncForEach(txArray, async job => {
      let gasLimit
      if (typeof job.extraGas === 'number') {
        gasLimit = addExtraGas(job.gasEstimate + job.extraGas, 0, MAX_GAS_LIMIT)
      } else {
        gasLimit = addExtraGas(job.gasEstimate, EXTRA_GAS_PERCENTAGE, MAX_GAS_LIMIT)
      }

      try {
        const newGasPriceOptions = chooseGasPriceOptions(gasPriceOptions, job.gasPriceOptions)
        if (isResend) {
          const tx = await web3Fallback.eth.getTransaction(job.txHash)

          if (tx && tx.blockNumber !== null) {
            logger.debug(`Transaction ${job.txHash} was successfully mined`)
            return
          }

          if (nonce === null) {
            nonce = await readNonce(true)
          }

          const oldGasPrice = JSON.stringify(job.gasPriceOptions)
          const newGasPrice = JSON.stringify(newGasPriceOptions)
          logger.info(`Transaction ${job.txHash} was not mined, updating gasPrice: ${oldGasPrice} -> ${newGasPrice}`)
        }
        logger.info(`Sending transaction with nonce ${nonce}`)
        const privateKey = await loadPrivateKey()
        const txHash = await sendTx({
          data: job.data,
          nonce,
          value: '0',
          gasLimit,
          privateKey,
          to: job.to,
          chainId,
          web3: web3Redundant,
          gasPriceOptions: newGasPriceOptions
        })
        const resendJob = {
          ...job,
          txHash,
          gasPriceOptions: newGasPriceOptions
        }
        resendJobs.push(resendJob)

        nonce++
        logger.info(
          { eventTransactionHash: job.transactionReference, generatedTransactionHash: txHash },
          `Tx generated ${txHash} for event Tx ${job.transactionReference}`
        )
      } catch (e) {
        logger.error(
          { eventTransactionHash: job.transactionReference, error: e.message },
          `Tx Failed for event Tx ${job.transactionReference}.`,
          e.message
        )

        if (isGasPriceError(e)) {
          logger.info('Replacement transaction underpriced, forcing gas price update')
          GasPrice.start(config.id, web3)
          failedTx.push(applyMinGasFeeBump(job, MIN_GAS_PRICE_BUMP_FACTOR))
        } else if (isResend || isSameTransactionError(e)) {
          resendJobs.push(job)
        } else {
          // if initial transaction sending has failed not due to the same hash error
          // send it to the failed tx queue
          // this will result in the sooner resend attempt than if using resendJobs
          failedTx.push(job)
        }

        if (isInsufficientBalanceError(e)) {
          insufficientFunds = true
          const validatorAddress = await getValidatorAddress()
          const currentBalance = await web3.eth.getBalance(validatorAddress)
          minimumBalance = gasLimit.multipliedBy(gasPriceOptions.gasPrice || gasPriceOptions.maxFeePerGas)
          logger.error(
            `Insufficient funds: ${currentBalance}. Stop processing messages until the balance is at least ${minimumBalance}.`
          )
        } else if (isNonceError(e)) {
          nonce = await readNonce(true)
        }
      }
    })

    if (typeof nonce === 'number') {
      logger.debug('Updating nonce')
      await updateNonce(nonce)
    }

    if (failedTx.length) {
      logger.info(`Sending ${failedTx.length} Failed Tx to Queue`)
      await scheduleForRetry(failedTx, msg.properties.headers['x-retries'])
    }
    if (resendJobs.length) {
      logger.info({ delay: config.resendInterval }, `Sending ${resendJobs.length} Tx Delayed Resend Requests to Queue`)
      await scheduleTransactionResend(resendJobs)
    }
    ackMsg(msg)
    logger.debug(`Finished processing msg`)

    if (insufficientFunds) {
      logger.warn('Insufficient funds. Stop sending transactions until the account has the minimum balance')
      channel.close()
      const validatorAddress = await getValidatorAddress()
      waitForFunds(web3, validatorAddress, minimumBalance, resume, logger)
    }
  } catch (e) {
    logger.error(e)
    nackMsg(msg)
  }

  logger.debug('Finished')
}

initialize()
