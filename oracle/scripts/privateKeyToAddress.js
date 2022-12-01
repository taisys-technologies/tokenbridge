require('../env')
const { privateKeyToAddress, loadPrivateKey } = require('../src/utils/utils')
const { EXIT_CODES } = require('../src/utils/constants')

const gcpSecretManagerPrivateKey = process.env.GCP_SECRET_MGR_ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY
let privateKey = process.env.ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY

if (gcpSecretManagerPrivateKey) {
  loadPrivateKey(gcpSecretManagerPrivateKey)
    .then(pk => {
      if (pk) {
        privateKey = pk
      } else {
        console.error('Environment variable GCP_SECRET_MGR_ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY is set but incorrect')
      }
    })
    .catch(e => {
      console.error(e)
    })
}

if (!privateKey) {
  console.error('Environment variable ORACLE_VALIDATOR_ADDRESS_PRIVATE_KEY is not set')
  process.exit(EXIT_CODES.GENERAL_ERROR)
}

const address = privateKeyToAddress(privateKey)

console.log(address)
