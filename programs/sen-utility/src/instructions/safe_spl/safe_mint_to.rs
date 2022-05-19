use crate::utils::collect_fee;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
pub struct SafeMintTo<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,
  /// CHECK: Just a pure account
  pub authority: AccountInfo<'info>,
  #[account(
    init_if_needed,
    payer = payer,
    associated_token::mint = mint,
    associated_token::authority = authority
  )]
  pub dst: Box<Account<'info, token::TokenAccount>>,
  #[account(mut)]
  pub mint: Account<'info, token::Mint>,
  #[account(mut)]
  /// CHECK: Just a pure account
  pub fee_collector: AccountInfo<'info>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn safe_mint_to(ctx: Context<SafeMintTo>, amount: u64, fee: u64) -> Result<()> {
  // Charge fee
  collect_fee(
    fee,
    ctx.accounts.fee_collector.to_account_info(),
    ctx.accounts.payer.to_account_info(),
    ctx.accounts.system_program.to_account_info(),
  )?;

  let mint_to_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::MintTo {
      mint: ctx.accounts.mint.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.payer.to_account_info(),
    },
  );
  token::mint_to(mint_to_ctx, amount)?;
  Ok(())
}
