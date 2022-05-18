use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
pub struct SafeTransfer<'info> {
  #[account(mut)]
  pub payer: Signer<'info>,
  /// CHECK: Just a pure account
  pub authority: AccountInfo<'info>,
  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = payer
  )]
  pub src: Box<Account<'info, token::TokenAccount>>,
  #[account(
    init_if_needed,
    payer = payer,
    associated_token::mint = mint,
    associated_token::authority = authority
  )]
  pub dst: Box<Account<'info, token::TokenAccount>>,
  pub mint: Account<'info, token::Mint>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn safe_transfer(ctx: Context<SafeTransfer>, amount: u64) -> Result<()> {
  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.payer.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, amount)?;
  Ok(())
}
