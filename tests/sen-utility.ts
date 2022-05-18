import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SenUtility } from "../target/types/sen_utility";

describe("sen-utility", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SenUtility as Program<SenUtility>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
