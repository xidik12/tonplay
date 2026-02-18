import "@stdlib/deploy";
import "@stdlib/ownable";
import "@stdlib/jetton";

// ============================================================================
// $TPLAY Jetton 2.0 — TEP-74 Compliant Jetton Master + Wallet
// ============================================================================
// Token metadata:
//   name        = "TONPLAY"
//   symbol      = "TPLAY"
//   decimals    = 9
//   description = "TONPLAY Arcade Gaming Token"
// ============================================================================

message Mint {
    amount: Int as coins;
    receiver: Address;
}

// ─── Jetton Master ──────────────────────────────────────────────────────────

contract TplayJetton with Jetton, Deployable, Ownable {
    totalSupply: Int as coins;
    owner: Address;
    content: Cell;
    mintable: Bool;

    init(owner: Address, content: Cell) {
        self.totalSupply = 0;
        self.owner = owner;
        self.content = content;
        self.mintable = true;
    }

    // --- Mint new tokens (owner only) ---
    receive(msg: Mint) {
        self.requireOwner();
        require(self.mintable, "Not mintable");
        self.mint(msg.receiver, msg.amount, self.owner);
    }

    // --- Jetton wallet init override ---
    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf TplayJettonWallet(owner_address, myAddress());
    }
}

// ─── Jetton Wallet ──────────────────────────────────────────────────────────

contract TplayJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton: Address;

    init(owner: Address, jetton: Address) {
        self.owner = owner;
        self.jetton = jetton;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf TplayJettonWallet(owner_address, self.jetton);
    }
}
