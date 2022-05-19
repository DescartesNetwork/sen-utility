import {
  AnchorProvider,
  BN,
  Program,
  utils,
  SplToken,
  Wallet,
  web3,
} from '@project-serum/anchor'
import { program as getSplProgram } from '@project-serum/anchor/dist/cjs/spl/token'
import { expect } from 'chai'

import Utility, {
  MerkleDistributor,
  Leaf,
  DEFAULT_SEN_UTILITY_PROGRAM_ID,
  FeeOptions,
} from '../app'
import { asyncWait, initializeMint, transferLamports } from '../utils'

const PRIV_KEY_FOR_TEST_ONLY = Buffer.from([
  2, 178, 226, 192, 204, 173, 232, 36, 247, 215, 203, 12, 177, 251, 254, 243,
  92, 38, 237, 60, 38, 248, 213, 19, 73, 180, 31, 164, 63, 210, 172, 90, 85,
  215, 166, 105, 84, 194, 133, 92, 34, 27, 39, 2, 158, 57, 64, 226, 198, 222,
  25, 127, 150, 87, 141, 234, 34, 239, 139, 107, 155, 32, 47, 199,
])
const SUPPLY = new BN(10 ** 9)
const AMOUNT = new BN(10 ** 3)
const DUMMY_METADATA = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
  'hex',
)

describe('@sentre/utility', function () {
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  const alice = new Wallet(new web3.Keypair())
  const bob = new Wallet(new web3.Keypair())
  const carol = new Wallet(new web3.Keypair())
  const feeOptions: FeeOptions = {
    fee: new BN(1000000),
    feeCollectorAddress: alice.publicKey.toBase58(),
  }

  let utility: Utility,
    splProgram: Program<SplToken>,
    dataBuffer: Buffer,
    distributorAddress: string,
    tokenAddress: string,
    currentTime: number

  before(async () => {
    const { program } = new Utility(wallet)
    const provider = program.provider as AnchorProvider
    splProgram = getSplProgram(provider)
    // Airdrop to wallets
    const lamports = await provider.connection.getBalance(wallet.publicKey)
    if (lamports < 9 * web3.LAMPORTS_PER_SOL)
      await provider.connection.requestAirdrop(
        wallet.publicKey,
        web3.LAMPORTS_PER_SOL,
      )
    await transferLamports(
      0.01 * web3.LAMPORTS_PER_SOL,
      alice.publicKey.toBase58(),
      provider,
    )
    await transferLamports(
      0.01 * web3.LAMPORTS_PER_SOL,
      bob.publicKey.toBase58(),
      provider,
    )
    await transferLamports(
      0.01 * web3.LAMPORTS_PER_SOL,
      carol.publicKey.toBase58(),
      provider,
    )
    // Init a token
    const token = web3.Keypair.generate()
    tokenAddress = token.publicKey.toBase58()
    await initializeMint(6, token, splProgram)
  })

  it('constructor', async () => {
    utility = new Utility(wallet)
    if (utility.program.programId.toBase58() !== DEFAULT_SEN_UTILITY_PROGRAM_ID)
      throw new Error('Cannot contruct a Sen Utility instance')
    // Current Unix Timestamp
    currentTime = await utility.getCurrentUnixTimestamp()
    // Merkle
    const treeData = [alice, bob, carol].map((keypair, i) => ({
      authority: keypair.publicKey,
      amount: AMOUNT,
      startedAt: new BN(currentTime + 5), // now + 5s
      salt: MerkleDistributor.salt(i.toString()),
    }))
    const merkleDistributor = new MerkleDistributor(treeData)
    dataBuffer = merkleDistributor.toBuffer()
  })

  it('safe mint to', async () => {
    await utility.safeMintTo({
      amount: SUPPLY,
      tokenAddress,
      dstWalletAddress: wallet.publicKey.toBase58(),
      feeOptions,
    })
    const tokenAccount = await utils.token.associatedAddress({
      mint: new web3.PublicKey(tokenAddress),
      owner: wallet.publicKey,
    })
    const { amount } = await splProgram.account.token.fetch(tokenAccount)
    expect(SUPPLY.eq(amount)).true
  })

  it('safe transfer', async () => {
    await utility.safeTransfer({
      amount: AMOUNT,
      tokenAddress,
      dstWalletAddress: alice.publicKey.toBase58(),
      feeOptions,
    })
    const tokenAccount = await utils.token.associatedAddress({
      mint: new web3.PublicKey(tokenAddress),
      owner: alice.publicKey,
    })
    const { amount } = await splProgram.account.token.fetch(tokenAccount)
    expect(AMOUNT.eq(amount)).true
  })

  it('initialize distributor', async () => {
    const merkleDistributor = MerkleDistributor.fromBuffer(dataBuffer)
    const data = await utility.initializeDistributor({
      tokenAddress,
      total: merkleDistributor.getTotal(),
      merkleRoot: merkleDistributor.deriveMerkleRoot(),
      metadata: DUMMY_METADATA,
      endedAt: currentTime + 15,
      feeOptions,
    })
    distributorAddress = data.distributorAddress
  })

  it('claim', async () => {
    const bobUtility = new Utility(bob)
    const merkleDistributor = MerkleDistributor.fromBuffer(dataBuffer)
    const bobData = merkleDistributor.receipients[1]
    const proof = merkleDistributor.deriveProof(bobData)
    const { dstAddress } = await bobUtility.claim({
      distributorAddress,
      proof,
      data: bobData,
      feeOptions,
    })
    const { amount } = await splProgram.account.token.fetch(dstAddress)
    expect(AMOUNT.eq(amount)).true
  })

  it('reclaim', async () => {
    const bobUtility = new Utility(bob)
    const merkleDistributor = MerkleDistributor.fromBuffer(dataBuffer)
    const bobData = merkleDistributor.receipients[1]
    const proof = merkleDistributor.deriveProof(bobData)
    try {
      await bobUtility.claim({ distributorAddress, proof, data: bobData })
      throw new Error('Bypass')
    } catch (er: any) {
      if (er.message == 'Bypass') throw new Error('Reclaim should be failed')
      else console.info(er.message)
    }
  })

  it('claim too late', async () => {
    await asyncWait(15)
    const carolUtility = new Utility(carol)
    const merkleDistributor = MerkleDistributor.fromBuffer(dataBuffer)
    const carolData = merkleDistributor.receipients[2]
    const proof = merkleDistributor.deriveProof(carolData)
    try {
      await carolUtility.claim({ distributorAddress, proof, data: carolData })
      throw new Error('Bypass')
    } catch (er: any) {
      if (er.message == 'Bypass')
        throw new Error('Claim too late should be failed')
      else console.info(er.message)
    }
  })
})
