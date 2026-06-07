// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GrailWatch — on-chain proof-of-reserves attestations for zkLTC
/// @notice zkLTC is claimed to be backed 1:1 by LTC locked on the Litecoin
///         mainchain via the BitcoinOS Grail Bridge. Hard money is only hard
///         if it's verifiable: registered attestors observe both chains and
///         post signed attestations on-chain — LTC locked on Litecoin vs the
///         zkLTC supply on LitVM — building a permanent, public audit trail.
///         If the backing ratio ever drops below 1:1, a BackingAlert fires.
contract ReserveAttestation {
    struct Attestation {
        address attestor;
        uint64 timestamp;
        uint256 ltcLockedSats; // LTC locked on Litecoin mainchain, in litoshis (1e8 per LTC)
        uint256 zkLtcSupplyWei; // observed zkLTC native supply on LitVM, in wei (1e18 per zkLTC)
        uint256 ratioBps; // backing ratio in basis points (10000 = exactly 1:1)
        string litecoinRef; // Litecoin block hash / height the observation was made at
    }

    /// @dev litoshis (1e8) -> wei (1e18)
    uint256 private constant SATS_TO_WEI = 1e10;
    uint256 private constant BPS = 10_000;

    address public owner;
    mapping(address => bool) public isAttestor;
    Attestation[] private _history;

    event AttestorSet(address indexed attestor, bool allowed);
    event Attested(
        uint256 indexed id,
        address indexed attestor,
        uint256 ltcLockedSats,
        uint256 zkLtcSupplyWei,
        uint256 ratioBps,
        string litecoinRef
    );
    event BackingAlert(uint256 indexed id, address indexed attestor, uint256 ratioBps);

    error NotOwner();
    error NotAttestor();
    error ZeroSupply();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        isAttestor[msg.sender] = true;
        emit AttestorSet(msg.sender, true);
    }

    function setAttestor(address attestor, bool allowed) external onlyOwner {
        isAttestor[attestor] = allowed;
        emit AttestorSet(attestor, allowed);
    }

    /// @notice Post a reserve observation. Reverts on zero supply; fires
    ///         BackingAlert when the ratio is below 1:1.
    function attest(
        uint256 ltcLockedSats,
        uint256 zkLtcSupplyWei,
        string calldata litecoinRef
    ) external returns (uint256 id) {
        if (!isAttestor[msg.sender]) revert NotAttestor();
        if (zkLtcSupplyWei == 0) revert ZeroSupply();

        uint256 ratioBps = (ltcLockedSats * SATS_TO_WEI * BPS) / zkLtcSupplyWei;
        id = _history.length;
        _history.push(
            Attestation({
                attestor: msg.sender,
                timestamp: uint64(block.timestamp),
                ltcLockedSats: ltcLockedSats,
                zkLtcSupplyWei: zkLtcSupplyWei,
                ratioBps: ratioBps,
                litecoinRef: litecoinRef
            })
        );

        emit Attested(id, msg.sender, ltcLockedSats, zkLtcSupplyWei, ratioBps, litecoinRef);
        if (ratioBps < BPS) {
            emit BackingAlert(id, msg.sender, ratioBps);
        }
    }

    /// @notice Latest attestation (the current health reading).
    function latest() external view returns (Attestation memory) {
        require(_history.length > 0, "no attestations");
        return _history[_history.length - 1];
    }

    /// @notice True when the most recent attestation shows >= 1:1 backing.
    function isFullyBacked() external view returns (bool) {
        if (_history.length == 0) return false;
        return _history[_history.length - 1].ratioBps >= BPS;
    }

    function attestationCount() external view returns (uint256) {
        return _history.length;
    }

    /// @notice Paginated history reader for the dashboard.
    function getAttestations(uint256 offset, uint256 limit)
        external
        view
        returns (Attestation[] memory page)
    {
        uint256 len = _history.length;
        if (offset >= len) return new Attestation[](0);
        uint256 end = offset + limit > len ? len : offset + limit;
        page = new Attestation[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = _history[i];
        }
    }
}
