use anchor_lang::{prelude::*, system_program};

pub fn current_timestamp() -> Option<i64> {
  let clock = Clock::get().ok()?;
  Some(clock.unix_timestamp)
}

pub fn collect_fee<'info>(
  fee: u64,
  fee_collector_acc: AccountInfo<'info>,
  authority_acc: AccountInfo<'info>,
  system_program_acc: AccountInfo<'info>,
) -> Result<()> {
  if fee > 0 {
    let fee_ctx = CpiContext::new(
      system_program_acc,
      system_program::Transfer {
        from: authority_acc,
        to: fee_collector_acc,
      },
    );
    system_program::transfer(fee_ctx, fee)?;
  }

  Ok(())
}
