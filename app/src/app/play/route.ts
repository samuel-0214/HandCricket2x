import {
  Action,
  ActionError,
  ActionPostRequest,
  createActionHeaders,
  createPostResponse,
} from "@solana/actions";
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const scoreMap = new Map<string, number>();
const hasPaidSet = new Set<string>(); 
const getComputerMove = () => Math.floor(Math.random() * 6) + 1;

const TREASURY_PUBKEY = new PublicKey("YOUR_TREASURY_PUBLIC_KEY_HERE");
const headers = createActionHeaders();
const ENTRY_FEE_LAMPORTS = 0.1 * LAMPORTS_PER_SOL;
const WIN_AMOUNT_LAMPORTS = 0.2 * LAMPORTS_PER_SOL;

export const GET = async () => {
  const payload: Action = {
    icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
    label: "Hand Cricket ☝️ ✌️ 🖐️",
    title: "Pay 0.1 SOL, then beat the computer!",
    description: "Click Start to pay the entry fee and begin the game",
    links: {
      actions: [
        {
          type: "transaction",
          label: "Start Game (0.1 SOL)",
          href: "/start",
        },
      ],
    },
    type: "action",
  };
  return Response.json(payload, { headers });
};

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest<{ options: string }> = await req.json();
    if (!body.account) {
      throw new Error("Missing 'account'");
    }
    const userPubkey = new PublicKey(body.account);
    const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl("devnet"));
    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const url = new URL(req.url);
    const path = url.pathname.toLowerCase();

    if (path.includes("start")) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: TREASURY_PUBKEY,
          lamports: ENTRY_FEE_LAMPORTS,
        })
      );

      hasPaidSet.add(userPubkey.toBase58());
      transaction.feePayer = userPubkey;
      transaction.recentBlockhash = blockhash;

      const payload = await createPostResponse({
        fields: {
          transaction,
          message: "Sign to pay 0.1 SOL and start the game!",
          type: "transaction",
          links: {
            next: {
              type: "inline",
              action: {
                type: "action",
                label: "Play Turn",
                icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
                title: "Choose your move",
                description: "Now that you've paid, let's play!",
                links: {
                  actions: [
                    {
                      type: "transaction",
                      label: "Play Turn",
                      href: "/play",
                      parameters: [
                        {
                          type: "radio",
                          name: "options",
                          options: [
                            { label: "1", value: "1", selected: false },
                            { label: "2", value: "2", selected: false },
                            { label: "3", value: "3", selected: false },
                            { label: "4", value: "4", selected: false },
                            { label: "5", value: "5", selected: false },
                            { label: "6", value: "6", selected: false },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      });

      return Response.json(payload, { headers });
    }
    
    if (path.includes("play")) {
      if (!hasPaidSet.has(userPubkey.toBase58())) {
        throw new Error("You haven't paid 0.1 SOL yet!");
      }

      const options = body.data?.options;
      if (!options || Array.isArray(options)) {
        throw new Error("Missing or invalid 'options'");
      }

      const userChoice = parseInt(options, 10);
      if (userChoice < 1 || userChoice > 6) {
        throw new Error("Invalid choice");
      }

      const accountKey = userPubkey.toBase58();
      let currentScore = scoreMap.get(accountKey) || 0;
      const computerMove = getComputerMove();
      const isOut = userChoice === computerMove;
      let message = `You played ${userChoice}, computer played ${computerMove}. `;

      if (!isOut) {
        currentScore += userChoice;
        scoreMap.set(accountKey, currentScore);
        message += `Score: ${currentScore}. Not out yet!`;
      } else {
        message += `OUT! Final Score: ${currentScore}. `;
        const compScore = Math.floor(Math.random() * (currentScore + 10));
        message += `Computer total: ${compScore}. `;

        if (compScore >= currentScore) {
          message += `Computer wins. No payout.`;
        } else {
          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: TREASURY_PUBKEY,
              toPubkey: userPubkey,
              lamports: WIN_AMOUNT_LAMPORTS,
            })
          );

          transaction.feePayer = userPubkey;
          transaction.recentBlockhash = blockhash;

          message += `You beat the computer! 0.2 SOL transaction built.`;

          const payload = await createPostResponse({
            fields: {
              transaction,
              message,
              type: "transaction",
              links: {
                next: {
                  type: "inline",
                  action: {
                    type: "action",
                    label: "Game Over!",
                    icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
                    title: "Congrats",
                    description: `You earned 0.2 SOL (pending signature).`,
                  },
                },
              },
            },
          });

          scoreMap.delete(accountKey);
          hasPaidSet.delete(accountKey);

          return Response.json(payload, { headers });
        }

        scoreMap.delete(accountKey);
        hasPaidSet.delete(accountKey);
      }

      const payload = await createPostResponse({
        fields: {
          transaction: new Transaction(), // Empty transaction for non-winning cases
          message,
          type: "transaction",
          links: {
            next: {
              type: "inline",
              action: {
                type: "action",
                label: isOut ? "Game Over" : "Next Ball",
                icon: "https://i.postimg.cc/52hr198Z/mainblink.png",
                title: "Hand Cricket",
                description: isOut
                  ? "Computer won. No payout. Start a new game."
                  : `Score: ${currentScore}. Keep playing!`,
                links: {
                  actions: isOut
                    ? [
                        {
                          type: "transaction",
                          label: "Start New Game (0.1 SOL)",
                          href: "/start",
                        },
                      ]
                    : [
                        {
                          type: "transaction",
                          label: "Play Turn",
                          href: "/play",
                          parameters: [
                            {
                              type: "radio",
                              name: "options",
                              options: [
                                { label: "1", value: "1", selected: false },
                                { label: "2", value: "2", selected: false },
                                { label: "3", value: "3", selected: false },
                                { label: "4", value: "4", selected: false },
                                { label: "5", value: "5", selected: false },
                                { label: "6", value: "6", selected: false },
                              ],
                            },
                          ],
                        },
                      ],
                },
              },
            },
          },
        },
      });

      return Response.json(payload, { headers });
    }

    throw new Error("Invalid endpoint");
  } catch (error) {
    console.error(error);
    const actionError: ActionError = { message: String(error) };
    return Response.json(actionError, { status: 400, headers });
  }
};

export const OPTIONS = async () => Response.json(null, { headers });