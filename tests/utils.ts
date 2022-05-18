import { web3, Spl, AnchorProvider } from '@project-serum/anchor'

const splProgram = Spl.token()

export const asyncWait = (s: number) =>
  new Promise((resolve) => setTimeout(resolve, s * 1000))

export const getCurrentTimestamp = () => Math.floor(Number(new Date()) / 1000)

export const initializeMint = async (
  decimals: number,
  token: web3.Keypair,
  provider: AnchorProvider,
) => {
  const ix = await (splProgram.account as any).mint.createInstruction(token)
  const tx = new web3.Transaction().add(ix)
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
