use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
pub struct SafeMintTo<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = mint,
    associated_token::authority = dst
  )]
  pub dst: Box<Account<'info, token::TokenAccount>>,
  pub mint: Account<'info, token::Mint>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn safe_mint_to(ctx: Context<SafeMintTo>, amount: u64) -> Result<()> {
  let mint_to_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::MintTo {
      mint: ctx.accounts.mint.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
    },
  );
  token::mint_to(mint_to_ctx, amount)?;
  Ok(())
}
