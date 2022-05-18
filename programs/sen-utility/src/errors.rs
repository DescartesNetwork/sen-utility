use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Operation overflowed")]
  Overflow,
  #[msg("Invalid merkle proof")]
  InvalidMerkleProof,
  #[msg("Cannot get current date")]
  InvalidCurrentDate,
  #[msg("The campaign has been ended")]
  EndedCampaign,
  #[msg("The campaign is not started yet")]
  NotStartedCampaign,
  #[msg("The campaign is not ended yet")]
  NotEndedCampaign,
  #[msg("Cannot derive the program address")]
  NoBump,
}
