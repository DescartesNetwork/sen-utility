use crate::errors::ErrorCode;
use crate::schema::{Distributor, Receipt};
use crate::utils::{collect_fee, current_timestamp};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct ClaimEvent {
  pub destination: Pubkey,
  pub amount: u64,
  pub started_at: i64,
  pub claimed_at: i64,
  pub claimed: u64,
}

#[derive(Accounts)]
#[instruction(proof: Vec<[u8; 32]>, amount: u64, started_at: i64, salt: [u8; 32], fee: u64)]
pub struct Claim<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = mint)]
  pub distributor: Account<'info, Distributor>,
  #[account(
    init,
    payer = authority,
    space = Receipt::LEN,
    seeds = [
      b"receipt".as_ref(),
      &salt,
      &distributor.key().to_bytes(),
      &authority.key().to_bytes()
    ],
    bump
  )]
  pub receipt: Account<'info, Receipt>,
  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = mint,
    associated_token::authority = authority
  )]
  pub dst: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &distributor.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = treasurer
  )]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
  #[account(mut)]
  /// CHECK: Just a pure account
  pub fee_collector: AccountInfo<'info>,
  pub mint: Box<Account<'info, token::Mint>>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn claim(
  ctx: Context<Claim>,
  proof: Vec<[u8; 32]>,
  amount: u64,
  started_at: i64,
  salt: [u8; 32],
  fee: u64,
) -> Result<()> {
  // Charge fee
  collect_fee(
    fee,
    ctx.accounts.fee_collector.to_account_info(),
    ctx.accounts.authority.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
  )?;

  let distributor = &mut ctx.accounts.distributor;
  let receipt = &mut ctx.accounts.receipt;

  let current = current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)?;
  // Update receipt data
  receipt.authority = ctx.accounts.authority.key();
  receipt.distributor = distributor.key();
  receipt.amount = amount;
  receipt.started_at = started_at;
  receipt.salt = salt;
  receipt.claimed_at = current;
  // Verify time
  if distributor.is_ended(current) {
    return err!(ErrorCode::EndedCampaign);
  }
  if !receipt.is_started(current) {
    return err!(ErrorCode::NotStartedCampaign);
  }
  // Verify merkle proof
  if !distributor.verify(proof, receipt.hash()) {
    return err!(ErrorCode::InvalidMerkleProof);
  }
  // Update distributor data
  distributor.claimed = distributor
    .claimed
    .checked_add(amount)
    .ok_or(ErrorCode::Overflow)?;
  // Unlock tokens in the treasury
  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &distributor.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];
  let transfer_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_ctx, amount)?;

  emit!(ClaimEvent {
    destination: ctx.accounts.dst.key(),
    amount,
    started_at,
    claimed_at: receipt.claimed_at,
    claimed: distributor.claimed,
  });

  Ok(())
}
