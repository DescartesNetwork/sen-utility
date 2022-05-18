use anchor_lang::prelude::*;

pub fn current_timestamp() -> Option<i64> {
  let clock = Clock::get().ok()?;
  Some(clock.unix_timestamp)
}
