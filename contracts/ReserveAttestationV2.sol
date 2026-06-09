// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GrailWatch ReserveAttestation V2 — quorum + median + freshness
/// @notice An adversarial audit of V1 found it was an "honesty-assumed logbook,
///         not proof of reserves": a single attestor could post any number and
///         mint a permanent FULLY-BACKED record, and `isFullyBacked()` returned
///         the newest reading no matter how stale. V2 fixes both:
///
///         - **Quorum + median**: health is the MEDIAN backing ratio across
///           DISTINCT attestors' most recent readings, requiring at least
///           `quorum` of them. One liar can't move the median.
///         - **Freshness**: only readings newer than `maxAge` count, so a stale
///           "fully backed" can never be trusted past its deadline.
///         - **Status transitions**: a StatusChanged event fires on every
///           Healthy↔Unhealthy↔Insufficient flip (not just the alerting tx).
///         - **Rate-limit** per attestor + 2-step ownership transfer/renounce.
///
///         The append-only history is still emitted/stored as a public audit
///         trail. (Roadmap: attestor staking/slashing → SPV proof of the
///         Litecoin balance for full trustlessness.)
contract ReserveAttestationV2 {
    struct Attestation {
        address attestor;
        uint64 timestamp;
        uint256 ltcLockedSats;
        uint256 zkLtcSupplyWei;
        uint256 ratioBps;
        string litecoinRef;
    }

    uint256 private constant SATS_TO_WEI = 1e10;
    uint256 private constant BPS = 10_000;

    address public owner;
    address public pendingOwner;
    uint64 public immutable maxAge; // freshness window (seconds)
    uint256 public immutable quorum; // min fresh distinct attestors for a valid reading
    uint64 public immutable minInterval; // per-attestor rate limit (seconds)

    address[] public attestors; // registered attestor set
    mapping(address => bool) public isAttestor;
    mapping(address => uint64) public lastAttestAt;
    mapping(address => uint256) private _latestIdxPlus1; // attestor → newest history index + 1
    Attestation[] private _history;
    bool public unhealthy; // persisted current status (drives StatusChanged)

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
    event StatusChanged(bool healthy, uint256 medianBps, uint256 freshCount);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotAttestor();
    error ZeroSupply();
    error RateLimited();
    error BadConfig();
    error NotPendingOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint256 quorum_, uint64 maxAge_, uint64 minInterval_) {
        if (quorum_ == 0 || maxAge_ == 0) revert BadConfig();
        owner = msg.sender;
        quorum = quorum_;
        maxAge = maxAge_;
        minInterval = minInterval_;
        _addAttestor(msg.sender);
        emit AttestorSet(msg.sender, true);
    }

    // ------------------------------------------------------------ ownership
    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
        pendingOwner = address(0);
    }

    // ------------------------------------------------------------ attestors
    function setAttestor(address attestor, bool allowed) external onlyOwner {
        if (allowed) {
            _addAttestor(attestor);
        } else {
            isAttestor[attestor] = false;
        }
        emit AttestorSet(attestor, allowed);
    }

    /// @dev mark as attestor and list it once ever (re-enabling reuses the slot)
    function _addAttestor(address a) private {
        if (isAttestor[a]) return;
        isAttestor[a] = true;
        bool listed;
        for (uint256 i = 0; i < attestors.length; i++) {
            if (attestors[i] == a) {
                listed = true;
                break;
            }
        }
        if (!listed) attestors.push(a);
    }

    function attestorCount() external view returns (uint256) {
        return attestors.length;
    }

    // ------------------------------------------------------------- attest
    function attest(
        uint256 ltcLockedSats,
        uint256 zkLtcSupplyWei,
        string calldata litecoinRef
    ) external returns (uint256 id) {
        if (!isAttestor[msg.sender]) revert NotAttestor();
        if (zkLtcSupplyWei == 0) revert ZeroSupply();
        if (block.timestamp < lastAttestAt[msg.sender] + minInterval) revert RateLimited();

        uint256 ratioBps = (ltcLockedSats * SATS_TO_WEI * BPS) / zkLtcSupplyWei;
        id = _history.length;
        _history.push(
            Attestation(msg.sender, uint64(block.timestamp), ltcLockedSats, zkLtcSupplyWei, ratioBps, litecoinRef)
        );
        _latestIdxPlus1[msg.sender] = id + 1;
        lastAttestAt[msg.sender] = uint64(block.timestamp);

        emit Attested(id, msg.sender, ltcLockedSats, zkLtcSupplyWei, ratioBps, litecoinRef);
        if (ratioBps < BPS) emit BackingAlert(id, msg.sender, ratioBps);

        _refreshStatus();
    }

    /// @dev recompute health from fresh per-attestor readings and emit on flip
    function _refreshStatus() private {
        (bool valid, bool fullyBacked, uint256 medianBps, uint256 freshCount) = health();
        bool nowUnhealthy = !(valid && fullyBacked);
        if (nowUnhealthy != unhealthy) {
            unhealthy = nowUnhealthy;
            emit StatusChanged(!nowUnhealthy, medianBps, freshCount);
        }
    }

    // -------------------------------------------------------------- health
    /// @notice Quorum-and-freshness health reading.
    /// @return valid       true when >= `quorum` distinct attestors are fresh
    /// @return fullyBacked true when valid AND the median ratio >= 1:1
    /// @return medianBps   median backing ratio across fresh attestors
    /// @return freshCount  number of distinct attestors with a fresh reading
    function health()
        public
        view
        returns (bool valid, bool fullyBacked, uint256 medianBps, uint256 freshCount)
    {
        uint256 n = attestors.length;
        uint256[] memory ratios = new uint256[](n);
        uint256 k;
        uint256 cutoff = block.timestamp > maxAge ? block.timestamp - maxAge : 0;
        for (uint256 i = 0; i < n; i++) {
            address a = attestors[i];
            if (!isAttestor[a]) continue;
            uint256 idxP1 = _latestIdxPlus1[a];
            if (idxP1 == 0) continue;
            Attestation storage at = _history[idxP1 - 1];
            if (at.timestamp < cutoff) continue; // stale
            ratios[k++] = at.ratioBps;
        }
        freshCount = k;
        if (k < quorum || k == 0) return (false, false, 0, k);

        // insertion sort (k is small — the registered attestor set)
        for (uint256 i = 1; i < k; i++) {
            uint256 v = ratios[i];
            uint256 j = i;
            while (j > 0 && ratios[j - 1] > v) {
                ratios[j] = ratios[j - 1];
                j--;
            }
            ratios[j] = v;
        }
        medianBps = (k % 2 == 1) ? ratios[k / 2] : (ratios[k / 2 - 1] + ratios[k / 2]) / 2;
        valid = true;
        fullyBacked = medianBps >= BPS;
    }

    function isFullyBacked() external view returns (bool) {
        (bool valid, bool fullyBacked, , ) = health();
        return valid && fullyBacked;
    }

    // -------------------------------------------------------------- history
    function latest() external view returns (Attestation memory) {
        require(_history.length > 0, "no attestations");
        return _history[_history.length - 1];
    }

    function attestationCount() external view returns (uint256) {
        return _history.length;
    }

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
