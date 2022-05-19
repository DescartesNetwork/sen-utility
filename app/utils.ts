import { web3 } from '@project-serum/anchor'

/**
 * Validate an address
 * @param address Base58 string
 * @returns true/false
 */
export const isAddress = (address: string | undefined): address is string => {
  if (!address) return false
  try {
    const publicKey = new web3.PublicKey(address)
    if (!publicKey) throw new Error('Invalid public key')
    return true
  } catch (er) {
    return false
  }
}

/**
 * Validate an hash (must have length 32)
 * @param hash Hash buffer
 * @returns true/false
 */
export const isHash = (hash: Buffer | Uint8Array): boolean => {
  if (!hash || hash.length !== 32) return false
  return true
}

/**
 * Find the my receipt of an proposal based on canonical bump
 * @param index Receipt index
 * @param proposalPublicKey Proposal public key
 * @param authorityPublicKey Receipt authority public key
 * @param programId InterDAO program public key
 * @returns Receipt public key
 */
export const findReceipt = async (
  salt: Buffer,
  distributorPublicKey: web3.PublicKey,
  authorityPublicKey: web3.PublicKey,
  programId: web3.PublicKey,
) => {
  const [receiptPublicKey] = await web3.PublicKey.findProgramAddress(
    [
      Buffer.from('receipt'),
      salt,
      distributorPublicKey.toBuffer(),
      authorityPublicKey.toBuffer(),
    ],
    programId,
  )
  return receiptPublicKey
}
