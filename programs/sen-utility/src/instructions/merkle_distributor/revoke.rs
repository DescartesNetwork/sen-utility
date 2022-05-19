use crate::errors::ErrorCode;
use crate::schema::Distributor;
use crate::utils::{collect_fee, current_timestamp};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct RevokeEvent {
  pub authority: Pubkey,
  pub distributor: Pubkey,
  pub remaining: u64,
}

#[derive(Accounts)]
pub struct Revoke<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = mint, has_one = authority)]
  pub distributor: Account<'info, Distributor>,
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

pub fn revoke(ctx: Context<Revoke>, fee: u64) -> Result<()> {
  // Charge fee
  collect_fee(
    fee,
    ctx.accounts.fee_collector.to_account_info(),
    ctx.accounts.authority.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
  )?;

  let distributor = &mut ctx.accounts.distributor;

  let current = current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)?;
  // Verify time
  if !distributor.is_ended(current) {
    return err!(ErrorCode::NotEndedCampaign);
  }
  // Revoke remaining tokens in treasury
  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &distributor.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];
  let remaining = distributor
    .total
    .checked_sub(distributor.claimed)
    .ok_or(ErrorCode::Overflow)?;
  let transfer_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_ctx, remaining)?;

  emit!(RevokeEvent {
    authority: ctx.accounts.authority.key(),
    distributor: ctx.accounts.distributor.key(),
    remaining,
  });

  Ok(())
}
