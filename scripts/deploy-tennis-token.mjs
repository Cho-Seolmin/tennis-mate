import { readFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const artifactPath = new URL(
  '../artifacts/contracts/TennisToken.sol/TennisToken.json',
  import.meta.url,
)

const key = readPrivateKey(process.env.MINTER_PRIVATE_KEY)
const rpcUrl = process.env.SEPOLIA_RPC_URL?.trim()

if (!key) {
  console.error('MINTER_PRIVATE_KEY가 없습니다. 키 값은 출력하지 않습니다. 배포하지 않았습니다.')
  process.exit(1)
}

if (!rpcUrl) {
  console.error('SEPOLIA_RPC_URL이 없습니다. 배포하지 않았습니다.')
  process.exit(1)
}

const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))
const account = privateKeyToAccount(key)
const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) })

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [account.address],
})
const receipt = await publicClient.waitForTransactionReceipt({ hash })

if (receipt.status !== 'success' || !receipt.contractAddress) {
  console.error('배포 트랜잭션이 성공하지 않았습니다. 계약 주소를 저장하지 않았습니다.')
  process.exit(1)
}

const address = receipt.contractAddress
const [name, symbol, decimals, owner, code] = await Promise.all([
  publicClient.readContract({ address, abi: artifact.abi, functionName: 'name' }),
  publicClient.readContract({ address, abi: artifact.abi, functionName: 'symbol' }),
  publicClient.readContract({ address, abi: artifact.abi, functionName: 'decimals' }),
  publicClient.readContract({ address, abi: artifact.abi, functionName: 'owner' }),
  publicClient.getBytecode({ address }),
])

if (
  name !== 'Tennis Token' ||
  symbol !== 'TNS' ||
  decimals !== 18 ||
  owner.toLowerCase() !== account.address.toLowerCase() ||
  !code
) {
  console.error('배포된 코드가 Tennis Token 조건과 맞지 않습니다. 성공으로 기록하지 않았습니다.')
  process.exit(1)
}

console.log(`contract=${address}`)
console.log(`deployTx=${hash}`)
console.log('chainId=11155111')

function readPrivateKey(value) {
  const trimmed = value?.trim() ?? ''
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? withPrefix : null
}
