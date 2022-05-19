import bs58 from 'bs58'
import { BorshAccountsCoder } from '@project-serum/anchor'

import { IDL } from '../target/types/sen_utility'

export const DEFAULT_RPC_ENDPOINT =
  'https://psytrbhymqlkfrhudd.dev.genesysgo.net:8899'
export const DEFAULT_SEN_UTILITY_PROGRAM_ID =
  '7oyG4wSf2kz2CxTqKTf1uhpPqrw9a8Av1w5t8Uj5PfXb'
export const DEFAULT_SEN_UTILITY_IDL = IDL

export const DISTRIBUTOR_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('distributor'),
)
export const RECEIPT_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('receipt'),
)
