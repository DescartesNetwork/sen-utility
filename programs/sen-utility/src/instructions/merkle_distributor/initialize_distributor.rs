use crate::schema::Distributor;
use crate::utils::collect_fee;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct InitializeDistributorEvent {
  pub authority: Pubkey,
  pub distributor: Pubkey,
  pub merkle_root: [u8; 32],
  pub total: u64,
  pub ended_at: i64,
  pub metadata: [u8; 32],
}

#[derive(Accounts)]
pub struct InitializeDistributor<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(init, payer = authority, space = Distributor::LEN)]
  pub distributor: Account<'info, Distributor>,
  #[account(mut, has_one = mint)]
  pub src: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &distributor.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  #[account(
    init,
    payer = authority,
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

pub fn initialize_distributor(
  ctx: Context<InitializeDistributor>,
  merkle_root: [u8; 32],
  total: u64,
  ended_at: i64,
  metadata: [u8; 32],
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

  // Deposit tokens to the treasury
  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, total)?;
  // Update distributor data
  distributor.authority = ctx.accounts.authority.key();
  distributor.mint = ctx.accounts.mint.key();
  distributor.merkle_root = merkle_root;
  distributor.total = total;
  distributor.claimed = 0;
  distributor.ended_at = ended_at;
  distributor.metadata = metadata;

  emit!(InitializeDistributorEvent {
    authority: distributor.authority,
    distributor: ctx.accounts.distributor.key(),
    merkle_root,
    total,
    ended_at,
    metadata
  });

  Ok(())
}
