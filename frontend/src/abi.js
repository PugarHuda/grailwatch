// ABI for ReserveAttestation, copied from the Hardhat artifact.
export const RESERVE_ATTESTATION_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "NotAttestor",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotOwner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroSupply",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "attestor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "ltcLockedSats",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "zkLtcSupplyWei",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "ratioBps",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "litecoinRef",
        "type": "string"
      }
    ],
    "name": "Attested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "attestor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "AttestorSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "attestor",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "ratioBps",
        "type": "uint256"
      }
    ],
    "name": "BackingAlert",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "ltcLockedSats",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "zkLtcSupplyWei",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "litecoinRef",
        "type": "string"
      }
    ],
    "name": "attest",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "attestationCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "offset",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      }
    ],
    "name": "getAttestations",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "attestor",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint256",
            "name": "ltcLockedSats",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "zkLtcSupplyWei",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ratioBps",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "litecoinRef",
            "type": "string"
          }
        ],
        "internalType": "struct ReserveAttestation.Attestation[]",
        "name": "page",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "isAttestor",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isFullyBacked",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "latest",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "attestor",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "internalType": "uint256",
            "name": "ltcLockedSats",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "zkLtcSupplyWei",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "ratioBps",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "litecoinRef",
            "type": "string"
          }
        ],
        "internalType": "struct ReserveAttestation.Attestation",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "attestor",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "allowed",
        "type": "bool"
      }
    ],
    "name": "setAttestor",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
