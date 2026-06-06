// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DocumentSignatureRegistry
 * @notice On-chain registry of academic/administrative document hashes for
 *         SIGCHAIN-UAD (Secure Integrated Governance Chain - Universitas Ahmad Dahlan).
 *
 *         Only the SHA-256 hash of a document is anchored on-chain together with
 *         the signer wallet address, block number and timestamp. The original PDF
 *         never leaves the backend storage — this guarantees integrity & non
 *         repudiation while keeping document contents private.
 */
contract DocumentSignatureRegistry {
    struct Record {
        address signer;     // wallet address that anchored the document
        uint256 timestamp;  // block timestamp when stored
        uint256 blockNumber;// block number when stored
        bool exists;        // existence flag
    }

    // documentHash (hex SHA-256 string) => Record
    mapping(string => Record) private _records;

    // Ordered list of every stored hash (useful for dashboards / indexing).
    string[] private _allHashes;

    address public immutable owner;

    event DocumentStored(
        string indexed documentHashIndexed,
        string documentHash,
        address indexed signer,
        uint256 blockNumber,
        uint256 timestamp
    );

    event DocumentSigned(
        string documentHash,
        address indexed signer,
        uint256 timestamp
    );

    event DocumentVerified(
        string documentHash,
        address indexed verifier,
        bool valid,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Anchor a document hash on-chain. A hash can only be stored once
     *         (immutability guarantee).
     * @param documentHash hex-encoded SHA-256 hash of the document.
     * @param signer wallet address recorded as the signer of the document.
     */
    function storeDocumentHash(string calldata documentHash, address signer) external {
        require(bytes(documentHash).length > 0, "EMPTY_HASH");
        require(signer != address(0), "ZERO_SIGNER");
        require(!_records[documentHash].exists, "HASH_ALREADY_EXISTS");

        _records[documentHash] = Record({
            signer: signer,
            timestamp: block.timestamp,
            blockNumber: block.number,
            exists: true
        });
        _allHashes.push(documentHash);

        emit DocumentStored(documentHash, documentHash, signer, block.number, block.timestamp);
        emit DocumentSigned(documentHash, signer, block.timestamp);
    }

    /**
     * @notice Returns true when the given document hash exists on-chain.
     * @dev Pure read — costs no gas when called via eth_call.
     */
    function verifyDocument(string calldata documentHash) external view returns (bool) {
        return _records[documentHash].exists;
    }

    /**
     * @notice Optional on-chain attestation of a verification event. Emits
     *         DocumentVerified so a verification can itself be auditable on-chain.
     */
    function attestVerification(string calldata documentHash) external returns (bool valid) {
        valid = _records[documentHash].exists;
        emit DocumentVerified(documentHash, msg.sender, valid, block.timestamp);
    }

    /**
     * @notice Full record for a document hash.
     * @return signer wallet address that anchored the document.
     * @return timestamp block timestamp of anchoring.
     * @return blockNumber block number of anchoring.
     * @return exists whether the hash is present.
     */
    function getDocumentData(string calldata documentHash)
        external
        view
        returns (address signer, uint256 timestamp, uint256 blockNumber, bool exists)
    {
        Record storage r = _records[documentHash];
        return (r.signer, r.timestamp, r.blockNumber, r.exists);
    }

    /**
     * @notice Returns the signer wallet address for a document hash.
     */
    function getSigner(string calldata documentHash) external view returns (address) {
        return _records[documentHash].signer;
    }

    /// @notice Total number of documents anchored on-chain.
    function totalDocuments() external view returns (uint256) {
        return _allHashes.length;
    }

    /// @notice Hash stored at a given index (for pagination/enumeration).
    function hashAt(uint256 index) external view returns (string memory) {
        require(index < _allHashes.length, "INDEX_OUT_OF_RANGE");
        return _allHashes[index];
    }
}
