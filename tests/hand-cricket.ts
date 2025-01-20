import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { HandCricket } from "../target/types/hand_cricket";
import { assert } from "chai";

describe("hand-cricket", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.HandCricket as Program<HandCricket>;
  const player = provider.wallet.publicKey; // Public key of the test wallet
  let gameAccount: anchor.web3.PublicKey;

  // Derive the PDA for the game account
  before(async () => {
    [gameAccount] = anchor.web3.PublicKey.findProgramAddressSync(
      [player.toBuffer()],
      program.programId
    );
    console.log(`Game account PDA: ${gameAccount.toBase58()}`);
  });

  // Helper function to fetch the game state
  const getGameState = async () => {
    return await program.account.gameAccount.fetch(gameAccount);
  };

  it("Initializes game when not active", async () => {
    const playerChoice = 2; // Valid choice to initialize the game

    await program.methods
      .playTurn(playerChoice)
      .accounts({
        gameAccount,
        player: player,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const gameState = await getGameState();
    assert.equal(gameState.isActive, true, "Game should be active after initialization.");
    assert.equal(
      gameState.player.toBase58(),
      player.toBase58(),
      "Player public key should match the account's player field."
    );
  });

  it("Rejects invalid player choices", async () => {
    const invalidChoices = [0, 7, 255];

    for (const choice of invalidChoices) {
      try {
        await program.methods
          .playTurn(choice)
          .accounts({
            gameAccount,
            player: player,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        assert.fail("Should have thrown an error for invalid choice");
      } catch (err) {
        assert.equal(
          err.error.errorCode.code,
          "InvalidChoice",
          "Expected error code for invalid choice"
        );
      }
    }
  });

  it("Player scores runs when choices don't match", async () => {
    const initialGameState = await getGameState();
    const initialScore = initialGameState.score;

    let turnPlayed = false;
    let attempts = 0;

    while (!turnPlayed && attempts < 10) {
      attempts++;
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice between 1 and 6

      try {
        await program.methods
          .playTurn(playerChoice)
          .accounts({
            gameAccount,
            player: player,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        const gameState = await getGameState();
        if (gameState.isActive) {
          assert.equal(
            gameState.score,
            initialScore + playerChoice,
            "Score should increase when choices don't match"
          );
          turnPlayed = true;
        } else {
          await program.methods
            .playTurn(1)
            .accounts({
              gameAccount,
              player: player,
              systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
        }
      } catch (err) {
        assert.fail(`Error occurred during play turn: ${err}`);
      }
    }

    if (!turnPlayed) {
      assert.fail("Couldn't play a turn where choices didn't match");
    }
  });

  it("Game ends when choices match", async () => {
    const initialGameState = await getGameState();

    let gameOver = false;
    let attempts = 0;

    while (!gameOver && attempts < 10) {
      attempts++;
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice between 1 and 6

      try {
        await program.methods
          .playTurn(playerChoice)
          .accounts({
            gameAccount,
            player: player,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        const gameState = await getGameState();
        if (!gameState.isActive) {
          gameOver = true;
          console.log(`Game over with final score: ${gameState.score}`);
        }
      } catch (err) {
        assert.fail(`Error occurred during game end check: ${err}`);
      }
    }

    if (!gameOver) {
      assert.fail("Couldn't end the game within 10 attempts");
    }
  });

  it("Score increases appropriately", async () => {
    const playerChoice = 4;

    await program.methods
      .playTurn(playerChoice)
      .accounts({
        gameAccount,
        player: player,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const gameState = await getGameState();
    assert.equal(
      gameState.score,
      playerChoice,
      "Score should increase by player's choice when choices don't match"
    );
  });

  it("Allows multiple plays within the same game", async () => {
    let totalScore = 0;
    let gameOver = false;

    for (let i = 0; i < 5 && !gameOver; i++) {
      const playerChoice = Math.floor(Math.random() * 6) + 1; // Random choice

      try {
        await program.methods
          .playTurn(playerChoice)
          .accounts({
            gameAccount,
            player: player,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();

        const gameState = await getGameState();
        if (gameState.isActive) {
          totalScore += playerChoice;
          assert.equal(gameState.score, totalScore);
        } else {
          gameOver = true;
          console.log(`Game over with final score: ${gameState.score}`);
        }
      } catch (err) {
        assert.fail(`Error during multiple plays: ${err}`);
      }
    }
  });
});
