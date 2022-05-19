import { web3, AnchorProvider, Program, SplToken } from '@project-serum/anchor'

export const asyncWait = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000))

export const getCurrentTimestamp = () => Math.floor(Number(new Date()) / 1000)

export const initializeMint = async (
  decimals: number,
  token: web3.Keypair,
  splProgram: Program<SplToken>,
) => {
  const ix = await (splProgram.account as any).mint.createInstruction(token)
  const tx = new web3.Transaction().add(ix)
  const provider = splProgram.provider as AnchorProvider
  await provider.sendAndConfirm(tx, [token])
  return await splProgram.rpc.initializeMint(
    decimals,
    provider.wallet.publicKey,
    provider.wallet.publicKey,
    {
      accounts: {
        mint: token.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [],
    },
  )
}

export const transferLamports = async (
  lamports: number,
  dstAddress: string,
  provider: AnchorProvider,
) => {
  const ix = web3.SystemProgram.transfer({
    fromPubkey: provider.wallet.publicKey,
    toPubkey: new web3.PublicKey(dstAddress),
    lamports: Number(lamports),
  })
  const tx = new web3.Transaction().add(ix)
  return await provider.sendAndConfirm(tx)
}
