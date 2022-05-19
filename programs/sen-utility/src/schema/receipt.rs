use crate::constants::*;
use anchor_lang::{prelude::*, solana_program::keccak};

#[account]
pub struct Receipt {
  pub destination: Pubkey,
  pub amount: u64,
  pub started_at: i64,
  pub claimed_at: i64,
  pub salt: [u8; 32],
}

impl Receipt {
  pub const LEN: usize =
    DISCRIMINATOR_SIZE + PUBKEY_SIZE + U64_SIZE + I64_SIZE + I64_SIZE + U8_SIZE * 32;

  pub fn is_started(&self, current_time: i64) -> bool {
    if self.started_at == 0 {
      return true;
    }
    return self.started_at <= current_time;
  }

  pub fn hash(&self) -> [u8; 32] {
    keccak::hashv(&[
      &self.destination.to_bytes(),
      &self.amount.to_le_bytes(),
      &self.started_at.to_le_bytes(),
      &self.salt,
    ])
    .0
  }
}
