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
import { initializeMint } from './utils'
import { SenUtility } from '../target/types/sen_utility'

describe('safe spl', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.local()
  setProvider(provider)

  const program = workspace.SenUtility as Program<SenUtility>
  const spl = Spl.token()
  const mint = new web3.Keypair()
  let walletTokenAccount: web3.PublicKey
  const alice = new web3.Keypair()
  let aliceTokenAccount: web3.PublicKey

  before(async () => {
    // Init a mint
    await initializeMint(9, mint, provider)
    // Derive token account
    walletTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: provider.wallet.publicKey,
    })
    aliceTokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: alice.publicKey,
    })
  })

  it('safe mint to', async () => {
    const amount = new BN(10 ** 9)
    await program.rpc.safeMintTo(amount, {
      accounts: {
        payer: provider.wallet.publicKey,
        authority: provider.wallet.publicKey,
        dst: walletTokenAccount,
        mint: mint.publicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    const { amount: nextAmount } = await spl.account.token.fetch(
      walletTokenAccount,
    )
    expect(nextAmount.eq(amount)).true
  })

  it('safe transfer', async () => {
    const amount = new BN(100)
    await program.rpc.safeTransfer(amount, {
      accounts: {
        payer: provider.wallet.publicKey,
        authority: alice.publicKey,
        src: walletTokenAccount,
        dst: aliceTokenAccount,
        mint: mint.publicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    const { amount: nextAmount } = await spl.account.token.fetch(
      aliceTokenAccount,
    )
    expect(nextAmount.eq(amount)).true
  })
})
