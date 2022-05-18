use crate::constants::*;
use anchor_lang::{prelude::*, solana_program::keccak};

#[account]
pub struct Distributor {
  pub authority: Pubkey,
  pub mint: Pubkey,
  pub merkle_root: [u8; 32],
  pub total: u64,
  pub claimed: u64,
  pub ended_at: i64,
}

impl Distributor {
  pub const LEN: usize =
    DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U8_SIZE * 32 + U64_SIZE + U64_SIZE + I64_SIZE;

  pub fn is_ended(&self, current_time: i64) -> bool {
    if self.ended_at == 0 {
      return false;
    }
    return self.ended_at > current_time;
  }

  pub fn verify(&self, proof: Vec<[u8; 32]>, leaf: [u8; 32]) -> bool {
    let mut parent = leaf;
    for sibling in proof.into_iter() {
      if parent <= sibling {
        parent = keccak::hashv(&[&parent, &sibling]).0;
      } else {
        parent = keccak::hashv(&[&sibling, &parent]).0;
      }
    }
    parent == self.merkle_root
  }
}
