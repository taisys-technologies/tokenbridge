const { SecretManagerServiceClient } = require('@google-cloud/secret-manager')

async function getPrivateKeyFromGCPSecretManager(keyPath) {
  const client = new SecretManagerServiceClient()
  const [accessResponse] = await client.accessSecretVersion({
    name: keyPath
  })
  return accessResponse.payload.data.toString('utf8')
}

module.exports = {
  getPrivateKeyFromGCPSecretManager
}
