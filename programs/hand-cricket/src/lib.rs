use anchor_lang::{prelude::*, solana_program::hash::hashv};

declare_id!("7tuKuppYmHV69KKakus2ztV81YrgvWx3vdbhGhxwF8uh");

#[program]
pub mod hand_cricket {
    use super::*;

    pub fn play_turn(ctx: Context<PlayTurn>, player_choice: u8) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;

        // Ensure the game is active
        if !game_account.is_active {
            game_account.player = *ctx.accounts.player.key;
            game_account.score = 0;
            game_account.is_active = true;
        }

        // Validate player choice
        require!(
            player_choice >= 1 && player_choice <= 6,
            HandCricketError::InvalidChoice
        );

        // Contract's (bowler's) choice
        let contract_choice = generate_contract_choice()?;

        msg!("Player choice: {}", player_choice);
        msg!("Contract choice: {}", contract_choice);

        if player_choice != contract_choice {
            game_account.score += player_choice as u32;
            msg!("Score updated: {}", game_account.score);
        } else {
            game_account.is_active = false;
            msg!("You're out! Final Score: {}", game_account.score);
        }

        Ok(())
    }
}

// Helper function to generate contract's choice
fn generate_contract_choice() -> Result<u8> {
    let clock = Clock::get()?;
    let slot = clock.slot;
    let unix_timestamp = clock.unix_timestamp as u64;

    // Serialize the slot and unix_timestamp into bytes
    let mut slot_bytes = slot.to_le_bytes().to_vec();
    let timestamp_bytes = unix_timestamp.to_le_bytes();
    slot_bytes.extend_from_slice(&timestamp_bytes);

    // Hash the combined bytes using Solana's hash function
    let hash_result = hashv(&[&slot_bytes]);

    // Convert the first 8 bytes of the hash to a u64 number
    let num = u64::from_le_bytes(hash_result.to_bytes()[..8].try_into().unwrap());

    // Calculate the choice between 1 and 6
    let choice = ((num % 6) + 1) as u8;

    Ok(choice)
}

#[derive(Accounts)]
pub struct PlayTurn<'info> {
    #[account(init_if_needed, payer = player, seeds = [player.key().as_ref()], bump, space = 8 + GameAccount::INIT_SPACE)]
    pub game_account: Account<'info, GameAccount>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct GameAccount {
    pub player: Pubkey,
    pub score: u32,
    pub is_active: bool,
}

#[error_code]
pub enum HandCricketError {
    #[msg("The game is not active.")]
    GameNotActive,
    #[msg("Invalid choice. Please choose a number between 1 and 6.")]
    InvalidChoice,
}

