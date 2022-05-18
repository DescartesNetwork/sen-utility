import { web3, BN } from '@project-serum/anchor'
import { keccak_256 as hash } from 'js-sha3'

export type Leaf = {
  destination: web3.PublicKey
  amount: BN
  startedAt: BN
}

class MerkleDistributor {
  public receipients: Leaf[]
  public leafs: Buffer[]

  constructor(receipients: Leaf[] = []) {
    this.receipients = receipients
    this.leafs = this.sort(
      ...this.receipients.map((receipient) => this.getLeaf(receipient)),
    )
  }

  private sort = (...args: Buffer[]): Buffer[] => {
    return [...args].sort(Buffer.compare)
  }

  private serialize = ({ destination, amount, startedAt }: Leaf): Buffer => {
    return Buffer.concat([
      destination.toBuffer(),
      amount.toBuffer('le', 8),
      startedAt.toBuffer('le', 8),
    ])
  }

  private deserialize = (buf: Buffer): Leaf => {
    if (buf.length !== 48) throw new Error('Invalid buffer')
    return {
      destination: new web3.PublicKey(buf.subarray(0, 32)),
      amount: new BN(buf.subarray(32, 40), 'le'),
      startedAt: new BN(buf.subarray(40, 48), 'le'),
    }
  }

  /**
   * For utils
   */

  getTotal = (): BN => {
    let total: BN = new BN(0)
    this.receipients.forEach(({ amount }) => (total = total.add(amount)))
    return total
  }

  /**
   * For tree storage
   */

  toBuffer = () => {
    return Buffer.concat(this.receipients.map(this.serialize))
  }

  fromBuffer = (buf: Buffer): Leaf[] => {
    if (buf.length % 48 !== 0) throw new Error('Invalid buffer')
    let re = []
    for (let i = 0; i < buf.length; i = i + 48)
      re.push(this.deserialize(buf.subarray(i, i + 48)))
    return re
  }

  /**
   * For proofs
   */

  private getLeaf = (data: Leaf): Buffer => {
    const seed = this.serialize(data)
    return Buffer.from(hash.digest(seed))
  }

  private getParent = (a: Buffer, b: Buffer): Buffer => {
    if (!a || !b) throw new Error('Invalid child')
    const seed = Buffer.concat(this.sort(a, b))
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

  deriveMerkleRoot = (): Buffer => {
    let layer = this.leafs
    while (layer.length > 1) layer = this.nextLayer(layer)
    return layer[0]
  }

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

  verifyProof = (proof: Buffer[], data: Leaf): boolean => {
    let child = this.getLeaf(data)
    for (const sibling of proof) {
      child = this.getParent(child, sibling)
    }
    return this.deriveMerkleRoot().compare(child) === 0
  }
}

export default MerkleDistributor
