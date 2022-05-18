use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod schema;
pub mod utils;

pub use errors::*;
pub use instructions::*;
pub use schema::*;

declare_id!("7oyG4wSf2kz2CxTqKTf1uhpPqrw9a8Av1w5t8Uj5PfXb");

#[program]
pub mod sen_utility {
  use super::*;

  pub fn initialize_distributor(
    ctx: Context<InitializeDistributor>,
    merkle_root: [u8; 32],
    total: u64,
    ended_at: i64,
    metadata: [u8; 32],
  ) -> Result<()> {
    merkle_distributor::initialize_distributor(ctx, merkle_root, total, ended_at, metadata)
  }

  pub fn claim(
    ctx: Context<Claim>,
    proof: Vec<[u8; 32]>,
    amount: u64,
    started_at: i64,
  ) -> Result<()> {
    merkle_distributor::claim(ctx, proof, amount, started_at)
  }

  pub fn revoke(ctx: Context<Revoke>) -> Result<()> {
    merkle_distributor::revoke(ctx)
  }

  pub fn safe_mint_to(ctx: Context<SafeMintTo>, amount: u64) -> Result<()> {
    safe_spl::safe_mint_to(ctx, amount)
  }

  pub fn safe_transfer(ctx: Context<SafeTransfer>, amount: u64) -> Result<()> {
    safe_spl::safe_transfer(ctx, amount)
  }
}
