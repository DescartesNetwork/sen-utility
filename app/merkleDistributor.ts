import { web3, BN } from '@project-serum/anchor'
import { keccak_256 as hash } from 'js-sha3'

export type Leaf = {
  authority: web3.PublicKey
  amount: BN
  startedAt: BN
  salt: Buffer // 32 bytes
}

export const LEAF_LEN = 80

export class MerkleDistributor {
  public receipients: Leaf[]
  public leafs: Buffer[]

  constructor(receipients: Leaf[] = []) {
    this.receipients = receipients
    this.leafs = MerkleDistributor.sort(
      ...this.receipients.map((receipient) => this.getLeaf(receipient)),
    )
  }

  static sort = (...args: Buffer[]): Buffer[] => {
    return [...args].sort((a, b) => {
      const i = Buffer.compare(a, b)
      if (i === 0) throw new Error('The receipients has a duplication')
      return i
    })
  }

  static serialize = ({ authority, amount, startedAt, salt }: Leaf): Buffer => {
    return Buffer.concat([
      authority.toBuffer(),
      amount.toArrayLike(Buffer, 'le', 8),
      startedAt.toArrayLike(Buffer, 'le', 8),
      salt,
    ])
  }

  static deserialize = (buf: Buffer): Leaf => {
    if (buf.length !== LEAF_LEN) throw new Error('Invalid buffer')
    return {
      authority: new web3.PublicKey(buf.subarray(0, 32)),
      amount: new BN(buf.subarray(32, 40), 'le'),
      startedAt: new BN(buf.subarray(40, 48), 'le'),
      salt: Buffer.from(buf.subarray(48, 80)),
    }
  }

  /**
   * Get total distributed tokens
   * @returns Total
   */
  getTotal = (): BN => {
    let total: BN = new BN(0)
    this.receipients.forEach(({ amount }) => (total = total.add(amount)))
    return total
  }

  static salt = (defaultSeed?: string): Buffer => {
    let _seed = ''
    while (_seed.length < 128)
      _seed = _seed + Math.round(Math.random() * 10).toString()
    const seed = defaultSeed || _seed
    return Buffer.from(hash.digest(seed))
  }

  /**
   * Convert current merkle tree to buffer.
   * @returns Buffer.
   */
  toBuffer = () => {
    return Buffer.concat(this.receipients.map(MerkleDistributor.serialize))
  }

  /**
   * Build a merkle distributor instance from merkle tree data buffer.
   * @param buf Merkle tree data buffer.
   * @returns Merkle distributor instance.
   */
  static fromBuffer = (buf: Buffer): MerkleDistributor => {
    if (buf.length % LEAF_LEN !== 0) throw new Error('Invalid buffer')
    let re: Leaf[] = []
    for (let i = 0; i < buf.length; i = i + LEAF_LEN)
      re.push(MerkleDistributor.deserialize(buf.subarray(i, i + LEAF_LEN)))
    return new MerkleDistributor(re)
  }

  private getLeaf = (data: Leaf): Buffer => {
    const seed = MerkleDistributor.serialize(data)
    return Buffer.from(hash.digest(seed))
  }

  private getParent = (a: Buffer, b: Buffer): Buffer => {
    if (!a || !b) throw new Error('Invalid child')
    const seed = Buffer.concat(MerkleDistributor.sort(a, b))
    return Buffer.from(hash.digest(seed))
  }

  private getSibling = (a: Buffer, layer: Buffer[]): Buffer | undefined => {
    const index = layer.findIndex((leaf) => leaf.compare(a) === 0)
    if (index === -1) throw new Error('Invalid child')
    return index % 2 === 1 ? layer[index - 1] : layer[index + 1]
  }

  private nextLayer = (bufs: Buffer[]) => {
    const _bufs = [...bufs]
    if (_bufs.length === 0) throw new Error('Invalid tree')
    if (_bufs.length === 1) return _bufs
    const carry = _bufs.length % 2 === 1 ? _bufs.pop() : undefined
    const re = []
    for (let i = 0; i < _bufs.length; i = i + 2)
      re.push(this.getParent(_bufs[i], _bufs[i + 1]))
    return carry ? [...re, carry] : re
  }

  /**
   * Get the merkle root.
   * @returns Merkle root.
   */
  deriveMerkleRoot = (): Buffer => {
    let layer = this.leafs
    while (layer.length > 1) layer = this.nextLayer(layer)
    return layer[0]
  }

  /**
   * Get merkle proof.
   * @param data Receiptent data.
   * @returns Merkle proof.
   */
  deriveProof = (data: Leaf): Buffer[] => {
    let child = this.getLeaf(data)
    const proof = []
    let layer = this.leafs
    while (layer.length > 1) {
      const sibling = this.getSibling(child, layer)
      if (sibling) {
        child = this.getParent(child, sibling)
        proof.push(sibling)
      }
      layer = this.nextLayer(layer)
    }
    return proof
  }

  /**
   * Verify a merkle proof.
   * @param proof Merkle proof.
   * @param data Receiptent data.
   * @returns Valid.
   */
  verifyProof = (proof: Buffer[], data: Leaf): boolean => {
    let child = this.getLeaf(data)
    for (const sibling of proof) {
      child = this.getParent(child, sibling)
    }
    return this.deriveMerkleRoot().compare(child) === 0
  }
}
