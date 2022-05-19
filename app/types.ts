import { IdlAccounts, Idl } from '@project-serum/anchor'
import { IdlEvent } from '@project-serum/anchor/dist/cjs/idl'
import { TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { SenUtility } from '../target/types/sen_utility'

export type AnchorWallet = Wallet

export type DistributorData = IdlAccounts<SenUtility>['distributor']
export type ReceiptData = IdlAccounts<SenUtility>['receipt']

type TypeDefDictionary<T extends IdlEvent[], Defined> = {
  [K in T[number]['name']]: TypeDef<
    {
      name: K
      type: {
        kind: 'struct'
        fields: Extract<T[number], { name: K }>['fields']
      }
    },
    Defined
  >
}
export type IdlEvents<T extends Idl> = TypeDefDictionary<
  NonNullable<T['events']>,
  Record<string, never>
>
