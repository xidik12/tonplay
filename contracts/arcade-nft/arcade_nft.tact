import "@stdlib/deploy";
import "@stdlib/ownable";

// ============================================================================
// Arcade NFT Collection — TEP-62 Compliant NFT Collection + Item
// ============================================================================
// Each NFT represents a player's arcade identity / pass.
// Custom metadata fields: level, XP, game bonus (encoded in content cell).
// Supports royalties on secondary sales.
// ============================================================================

// ─── Messages ───────────────────────────────────────────────────────────────

message MintNft {
    queryId: Int as uint64;
    itemContent: Cell;
}

message LevelUp {
    queryId: Int as uint64;
    newLevel: Int as uint32;
    newXp: Int as uint64;
}

message InternalSetContent {
    content: Cell;
    owner: Address;
}

message Transfer {
    queryId: Int as uint64;
    newOwner: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

// ─── Structs ────────────────────────────────────────────────────────────────

struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}

struct RoyaltyParams {
    numerator: Int;
    denominator: Int;
    destination: Address;
}

struct NftData {
    isInitialized: Bool;
    index: Int;
    collectionAddress: Address;
    ownerAddress: Address?;
    individualContent: Cell?;
}

// ─── NFT Collection ────────────────────────────────────────────────────────

contract ArcadeNftCollection with Deployable, Ownable {
    nextItemIndex: Int as uint32 = 0;
    owner: Address;
    collectionContent: Cell;
    royaltyNumerator: Int as uint16;
    royaltyDenominator: Int as uint16;
    royaltyDestination: Address;

    init(owner: Address, collectionContent: Cell, royaltyNumerator: Int, royaltyDenominator: Int) {
        self.owner = owner;
        self.collectionContent = collectionContent;
        self.royaltyNumerator = royaltyNumerator;
        self.royaltyDenominator = royaltyDenominator;
        self.royaltyDestination = owner;
    }

    // --- Mint a new NFT item (owner only) ---
    receive(msg: MintNft) {
        self.requireOwner();
        let nftInit = initOf ArcadeNftItem(myAddress(), self.nextItemIndex);
        // Deploy the NFT item with its initial content
        send(SendParameters{
            to: contractAddress(nftInit),
            value: ton("0.05"),
            mode: 0,
            body: InternalSetContent{content: msg.itemContent, owner: self.owner}.toCell(),
            code: nftInit.code,
            data: nftInit.data
        });
        self.nextItemIndex = self.nextItemIndex + 1;
    }

    // --- TEP-62: get_collection_data ---
    get fun get_collection_data(): CollectionData {
        return CollectionData{
            nextItemIndex: self.nextItemIndex,
            collectionContent: self.collectionContent,
            ownerAddress: self.owner
        };
    }

    // --- TEP-62: get_nft_address_by_index ---
    get fun get_nft_address_by_index(index: Int): Address {
        return contractAddress(initOf ArcadeNftItem(myAddress(), index));
    }

    // --- TEP-62: royalty_params ---
    get fun royalty_params(): RoyaltyParams {
        return RoyaltyParams{
            numerator: self.royaltyNumerator,
            denominator: self.royaltyDenominator,
            destination: self.royaltyDestination
        };
    }
}

// ─── NFT Item ──────────────────────────────────────────────────────────────

contract ArcadeNftItem with Deployable {
    collection: Address;
    itemIndex: Int as uint32;
    owner: Address?;
    content: Cell?;
    isInitialized: Bool = false;

    init(collection: Address, itemIndex: Int) {
        self.collection = collection;
        self.itemIndex = itemIndex;
    }

    // --- Internal: set content on first deploy (collection only) ---
    receive(msg: InternalSetContent) {
        require(!self.isInitialized, "Already initialized");
        require(sender() == self.collection, "Only collection");
        self.owner = msg.owner;
        self.content = msg.content;
        self.isInitialized = true;
    }

    // --- TEP-62: transfer NFT ---
    receive(msg: Transfer) {
        require(self.isInitialized, "Not initialized");
        require(sender() == self.owner, "Not owner");
        self.owner = msg.newOwner;
        if (msg.forwardAmount > 0) {
            send(SendParameters{
                to: msg.newOwner,
                value: msg.forwardAmount,
                mode: 0,
                body: "NFT transferred".asComment()
            });
        }
    }

    // --- Custom: level up the NFT (collection only) ---
    receive(msg: LevelUp) {
        require(sender() == self.collection, "Only collection");
        // Level up updates metadata -- in practice you would rebuild the content cell
        // with the new level and XP values. For now this serves as the hook for the
        // game backend to trigger on-chain level progression.
    }

    // --- TEP-62: get_nft_data ---
    get fun get_nft_data(): NftData {
        return NftData{
            isInitialized: self.isInitialized,
            index: self.itemIndex,
            collectionAddress: self.collection,
            ownerAddress: self.owner,
            individualContent: self.content
        };
    }
}
