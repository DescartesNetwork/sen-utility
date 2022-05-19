import {
  web3,
  setProvider,
  workspace,
  utils,
  Spl,
  BN,
  AnchorProvider,
  Program,
} from '@project-serum/anchor'
import { expect } from 'chai'
import { asyncWait, getCurrentTimestamp, initializeMint } from '../utils'
import { SenUtility } from '../target/types/sen_utility'
import { MerkleDistributor, Leaf } from '../app/merkleDistributor'

const AMOUNT = new BN(1000)
const DUMMY_METADATA = [
  ...Buffer.from(
    'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
    'hex',
  ),
]

describe('merkle distributor', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.local()
  setProvider(provider)

  const program = workspace.SenUtility as Program<SenUtility>
  const spl = Spl.token()
  let merkleDistributor: MerkleDistributor
  let treeData: Leaf[]
  const mint = new web3.Keypair()
  const distributor = new web3.Keypair()
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey
  let walletTokenAccount: web3.PublicKey
  const alice = new web3.Keypair()
  let aliceTokenAccount: web3.PublicKey
  let aliceReceipt: web3.PublicKey
  const bob = new web3.Keypair()
  let bobTokenAccount: web3.PublicKey
  let bobReceipt: web3.PublicKey
  const carol = new web3.Keypair()
  let carolTokenAccount: web3.PublicKey
  let carolReceipt: web3.PublicKey

  before(async () => {
    // Derive token account
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), distributor.publicKey.toBuffer()],
      program.programId,
    )
    treasurer = treasurerPublicKey
    treasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: treasurer,
    })
    walletTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: provider.wallet.publicKey,
    })
    // Alice
    provider.connection.requestAirdrop(alice.publicKey, 10 ** 9)
    aliceTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: alice.publicKey,
    })
    // Bob
    provider.connection.requestAirdrop(bob.publicKey, 10 ** 9)
    bobTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: bob.publicKey,
    })
    // Carol
    provider.connection.requestAirdrop(carol.publicKey, 10 ** 9)
    carolTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: carol.publicKey,
    })
    // Init a mint
    await initializeMint(9, mint, spl)
    await program.rpc.safeMintTo(new BN(10 ** 9), new BN(0), {
      accounts: {
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        dst: walletTokenAccount,
        feeCollector: provider.wallet.publicKey,
        mint: mint.publicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    // Tree data
    treeData = [alice, bob, carol].map((wallet, i) => ({
      authority: wallet.publicKey,
      amount: AMOUNT,
      startedAt: new BN(getCurrentTimestamp() + 5), // now + 5s
      salt: MerkleDistributor.salt(i.toString()),
    }))
    merkleDistributor = new MerkleDistributor(treeData)
    // Receipts
    const [aliceReceiptPublicKey, bobReceiptPublicKey, carolReceiptPublicKey] =
      await Promise.all(
        treeData.map(async ({ authority, salt }, i) => {
          const [receiptPublicKey] = await web3.PublicKey.findProgramAddress(
            [
              Buffer.from('receipt'),
              salt,
              distributor.publicKey.toBuffer(),
              authority.toBuffer(),
            ],
            program.programId,
          )
          return receiptPublicKey
        }),
      )
    aliceReceipt = aliceReceiptPublicKey
    bobReceipt = bobReceiptPublicKey
    carolReceipt = carolReceiptPublicKey
  })

  it('initialize distributor', async () => {
    const merkleRoot = merkleDistributor.deriveMerkleRoot()
    const total = merkleDistributor.getTotal()

    await program.rpc.initializeDistributor(
      [...merkleRoot],
      total,
      new BN(getCurrentTimestamp() + 15), // now + 10s
      DUMMY_METADATA,
      new BN(1),
      {
        accounts: {
          authority: provider.wallet.publicKey,
          distributor: distributor.publicKey,
          src: walletTokenAccount,
          treasurer,
          treasury,
          feeCollector: provider.wallet.publicKey,
          mint: mint.publicKey,
          tokenProgram: utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [distributor],
      },
    )
    const { total: nextTotal } = await program.account.distributor.fetch(
      distributor.publicKey,
    )
    expect(nextTotal.eq(total)).true
    const { amount } = await spl.account.token.fetch(treasury)
    expect(amount.eq(total)).true
  })

  it('claim in hustle', async () => {
    const aliceData = treeData[0]
    const proof = merkleDistributor.deriveProof(aliceData)
    try {
      await program.rpc.claim(
        proof,
        aliceData.amount,
        aliceData.startedAt,
        aliceData.salt,
        new BN(1),
        {
          accounts: {
            authority: alice.publicKey,
            distributor: distributor.publicKey,
            receipt: aliceReceipt,
            dst: aliceTokenAccount,
            treasurer,
            treasury,
            feeCollector: provider.wallet.publicKey,
            mint: mint.publicKey,
            tokenProgram: utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [alice],
        },
      )
      throw new Error('Bypass')
    } catch (er: any) {
      if (er.message === 'Bypass')
        throw new Error('Claim in hustle should be failed')
    }
  })

  it('claim', async () => {
    await asyncWait(10)
    const bobData = treeData[1]
    const proof = merkleDistributor.deriveProof(bobData)
    await program.rpc.claim(
      proof,
      bobData.amount,
      bobData.startedAt,
      bobData.salt,
      new BN(1),
      {
        accounts: {
          authority: bob.publicKey,
          distributor: distributor.publicKey,
          receipt: bobReceipt,
          dst: bobTokenAccount,
          treasurer,
          treasury,
          feeCollector: provider.wallet.publicKey,
          mint: mint.publicKey,
          tokenProgram: utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [bob],
      },
    )
    const { amount: nextAmount } = await spl.account.token.fetch(
      bobTokenAccount,
    )
    expect(nextAmount.eq(AMOUNT)).true
  })

  it('claim too late', async () => {
    await asyncWait(10)
    const carolData = treeData[2]
    const proof = merkleDistributor.deriveProof(carolData)
    try {
      await program.rpc.claim(
        proof,
        carolData.amount,
        carolData.startedAt,
        carolData.salt,
        new BN(1),
        {
          accounts: {
            authority: carol.publicKey,
            distributor: distributor.publicKey,
            receipt: carolReceipt,
            dst: carolTokenAccount,
            treasurer,
            treasury,
            feeCollector: provider.wallet.publicKey,
            mint: mint.publicKey,
            tokenProgram: utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: web3.SystemProgram.programId,
            rent: web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [carol],
        },
      )
      throw new Error('Bypass')
    } catch (er: any) {
      if (er.message == 'Bypass')
        throw new Error('Claim too late should be failed')
    }
  })

  it('revoke', async () => {
    await program.rpc.revoke(new BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        distributor: distributor.publicKey,
        dst: walletTokenAccount,
        treasurer,
        treasury,
        feeCollector: provider.wallet.publicKey,
        mint: mint.publicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
  })
})
