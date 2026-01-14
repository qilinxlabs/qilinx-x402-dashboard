// Solidity compiler service using solc
// Task 5.1: Compiler service

import solc from "solc";
import type { SourceFile } from "@/lib/db/schema";

export interface CompileResult {
  success: boolean;
  abi?: object[];
  bytecode?: string;
  errors?: string[];
}

export interface MultiFileCompileResult {
  success: boolean;
  contracts: {
    [filename: string]: {
      contractName: string;
      bytecode: string;
      abi: object[];
    };
  };
  errors?: string[];
}

// OpenZeppelin imports resolver - provides common interfaces
const OPENZEPPELIN_SOURCES: Record<string, string> = {
  "@openzeppelin/contracts/token/ERC20/IERC20.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}`,
  "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IERC20} from "../IERC20.sol";
library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(token.transfer, (to, value)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transfer failed");
    }
    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeCall(token.transferFrom, (from, to, value)));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "SafeERC20: transferFrom failed");
    }
    function forceApprove(IERC20 token, address spender, uint256 value) internal {
        bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
        if (!_callOptionalReturnBool(token, approvalCall)) {
            _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
            _callOptionalReturn(token, approvalCall);
        }
    }
    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        (bool success, bytes memory returndata) = address(token).call(data);
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))), "SafeERC20: call failed");
    }
    function _callOptionalReturnBool(IERC20 token, bytes memory data) private returns (bool) {
        (bool success, bytes memory returndata) = address(token).call(data);
        return success && (returndata.length == 0 || abi.decode(returndata, (bool)));
    }
}`,
  "@openzeppelin/contracts/access/Ownable.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
abstract contract Ownable {
    address private _owner;
    error OwnableUnauthorizedAccount(address account);
    error OwnableInvalidOwner(address owner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(initialOwner);
    }
    modifier onlyOwner() {
        _checkOwner();
        _;
    }
    function owner() public view virtual returns (address) { return _owner; }
    function _checkOwner() internal view virtual {
        if (owner() != msg.sender) revert OwnableUnauthorizedAccount(msg.sender);
    }
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        _transferOwnership(newOwner);
    }
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}`,
  "@openzeppelin/contracts/utils/ReentrancyGuard.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
abstract contract ReentrancyGuard {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status;
    error ReentrancyGuardReentrantCall();
    constructor() { _status = NOT_ENTERED; }
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }
    function _nonReentrantBefore() private {
        if (_status == ENTERED) revert ReentrancyGuardReentrantCall();
        _status = ENTERED;
    }
    function _nonReentrantAfter() private { _status = NOT_ENTERED; }
}`,
  "@openzeppelin/contracts/token/ERC721/IERC721.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}`,
  "@openzeppelin/contracts/token/ERC721/ERC721.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IERC721} from "./IERC721.sol";
contract ERC721 is IERC721 {
    string private _name;
    string private _symbol;
    mapping(uint256 tokenId => address) private _owners;
    mapping(address owner => uint256) private _balances;
    mapping(uint256 tokenId => address) private _tokenApprovals;
    mapping(address owner => mapping(address operator => bool)) private _operatorApprovals;
    error ERC721InvalidOwner(address owner);
    error ERC721NonexistentToken(uint256 tokenId);
    error ERC721IncorrectOwner(address sender, uint256 tokenId, address owner);
    error ERC721InvalidSender(address sender);
    error ERC721InvalidReceiver(address receiver);
    error ERC721InsufficientApproval(address operator, uint256 tokenId);
    error ERC721InvalidApprover(address approver);
    error ERC721InvalidOperator(address operator);
    constructor(string memory name_, string memory symbol_) { _name = name_; _symbol = symbol_; }
    function name() public view virtual returns (string memory) { return _name; }
    function symbol() public view virtual returns (string memory) { return _symbol; }
    function balanceOf(address owner) public view virtual returns (uint256) {
        if (owner == address(0)) revert ERC721InvalidOwner(address(0));
        return _balances[owner];
    }
    function ownerOf(uint256 tokenId) public view virtual returns (address) {
        return _requireOwned(tokenId);
    }
    function approve(address to, uint256 tokenId) public virtual {
        _approve(to, tokenId, msg.sender);
    }
    function getApproved(uint256 tokenId) public view virtual returns (address) {
        _requireOwned(tokenId);
        return _tokenApprovals[tokenId];
    }
    function setApprovalForAll(address operator, bool approved) public virtual {
        _setApprovalForAll(msg.sender, operator, approved);
    }
    function isApprovedForAll(address owner, address operator) public view virtual returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    function transferFrom(address from, address to, uint256 tokenId) public virtual {
        if (to == address(0)) revert ERC721InvalidReceiver(address(0));
        address previousOwner = _update(to, tokenId, msg.sender);
        if (previousOwner != from) revert ERC721IncorrectOwner(from, tokenId, previousOwner);
    }
    function safeTransferFrom(address from, address to, uint256 tokenId) public { safeTransferFrom(from, to, tokenId, ""); }
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory) public virtual { transferFrom(from, to, tokenId); }
    function _ownerOf(uint256 tokenId) internal view virtual returns (address) { return _owners[tokenId]; }
    function _requireOwned(uint256 tokenId) internal view returns (address) {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert ERC721NonexistentToken(tokenId);
        return owner;
    }
    function _isAuthorized(address owner, address spender, uint256 tokenId) internal view virtual returns (bool) {
        return spender != address(0) && (owner == spender || isApprovedForAll(owner, spender) || _tokenApprovals[tokenId] == spender);
    }
    function _checkAuthorized(address owner, address spender, uint256 tokenId) internal view virtual {
        if (!_isAuthorized(owner, spender, tokenId)) {
            if (owner == address(0)) revert ERC721NonexistentToken(tokenId);
            else revert ERC721InsufficientApproval(spender, tokenId);
        }
    }
    function _update(address to, uint256 tokenId, address auth) internal virtual returns (address) {
        address from = _ownerOf(tokenId);
        if (auth != address(0)) _checkAuthorized(from, auth, tokenId);
        if (from != address(0)) { _approve(address(0), tokenId, address(0), false); unchecked { _balances[from] -= 1; } }
        if (to != address(0)) { unchecked { _balances[to] += 1; } }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
        return from;
    }
    function _mint(address to, uint256 tokenId) internal { if (to == address(0)) revert ERC721InvalidReceiver(address(0)); _update(to, tokenId, address(0)); }
    function _safeMint(address to, uint256 tokenId) internal { _mint(to, tokenId); }
    function _burn(uint256 tokenId) internal { _update(address(0), tokenId, address(0)); }
    function _approve(address to, uint256 tokenId, address auth) internal { _approve(to, tokenId, auth, true); }
    function _approve(address to, uint256 tokenId, address auth, bool emitEvent) internal virtual {
        if (emitEvent || auth != address(0)) {
            address owner = _requireOwned(tokenId);
            if (auth != address(0) && owner != auth && !isApprovedForAll(owner, auth)) revert ERC721InvalidApprover(auth);
            if (emitEvent) emit Approval(owner, to, tokenId);
        }
        _tokenApprovals[tokenId] = to;
    }
    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        if (operator == address(0)) revert ERC721InvalidOperator(address(0));
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }
}`,
  "@openzeppelin/contracts/token/ERC20/ERC20.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {IERC20} from "./IERC20.sol";
contract ERC20 is IERC20 {
    mapping(address account => uint256) private _balances;
    mapping(address account => mapping(address spender => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed);
    error ERC20InvalidSender(address sender);
    error ERC20InvalidReceiver(address receiver);
    error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed);
    error ERC20InvalidApprover(address approver);
    error ERC20InvalidSpender(address spender);
    constructor(string memory name_, string memory symbol_) { _name = name_; _symbol = symbol_; }
    function name() public view virtual returns (string memory) { return _name; }
    function symbol() public view virtual returns (string memory) { return _symbol; }
    function decimals() public view virtual returns (uint8) { return 18; }
    function totalSupply() public view virtual returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view virtual returns (uint256) { return _balances[account]; }
    function transfer(address to, uint256 value) public virtual returns (bool) { _transfer(msg.sender, to, value); return true; }
    function allowance(address owner, address spender) public view virtual returns (uint256) { return _allowances[owner][spender]; }
    function approve(address spender, uint256 value) public virtual returns (bool) { _approve(msg.sender, spender, value); return true; }
    function transferFrom(address from, address to, uint256 value) public virtual returns (bool) { _spendAllowance(from, msg.sender, value); _transfer(from, to, value); return true; }
    function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) revert ERC20InvalidSender(address(0));
        if (to == address(0)) revert ERC20InvalidReceiver(address(0));
        _update(from, to, value);
    }
    function _update(address from, address to, uint256 value) internal virtual {
        if (from == address(0)) { _totalSupply += value; }
        else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) revert ERC20InsufficientBalance(from, fromBalance, value);
            unchecked { _balances[from] = fromBalance - value; }
        }
        if (to == address(0)) { unchecked { _totalSupply -= value; } }
        else { unchecked { _balances[to] += value; } }
        emit Transfer(from, to, value);
    }
    function _mint(address account, uint256 value) internal { if (account == address(0)) revert ERC20InvalidReceiver(address(0)); _update(address(0), account, value); }
    function _burn(address account, uint256 value) internal { if (account == address(0)) revert ERC20InvalidSender(address(0)); _update(account, address(0), value); }
    function _approve(address owner, address spender, uint256 value) internal { _approve(owner, spender, value, true); }
    function _approve(address owner, address spender, uint256 value, bool emitEvent) internal virtual {
        if (owner == address(0)) revert ERC20InvalidApprover(address(0));
        if (spender == address(0)) revert ERC20InvalidSpender(address(0));
        _allowances[owner][spender] = value;
        if (emitEvent) emit Approval(owner, spender, value);
    }
    function _spendAllowance(address owner, address spender, uint256 value) internal virtual {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            if (currentAllowance < value) revert ERC20InsufficientAllowance(spender, currentAllowance, value);
            unchecked { _approve(owner, spender, currentAllowance - value, false); }
        }
    }
}`,
  "@openzeppelin/contracts/utils/cryptography/EIP712.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
abstract contract EIP712 {
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    address private immutable _cachedThis;
    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;
    bytes32 private constant TYPE_HASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    constructor(string memory name, string memory version) {
        _hashedName = keccak256(bytes(name));
        _hashedVersion = keccak256(bytes(version));
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _buildDomainSeparator();
        _cachedThis = address(this);
    }
    function _domainSeparatorV4() internal view returns (bytes32) {
        if (address(this) == _cachedThis && block.chainid == _cachedChainId) return _cachedDomainSeparator;
        return _buildDomainSeparator();
    }
    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(TYPE_HASH, _hashedName, _hashedVersion, block.chainid, address(this)));
    }
    function _hashTypedDataV4(bytes32 structHash) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked("\\x19\\x01", _domainSeparatorV4(), structHash));
    }
}`,
  "@openzeppelin/contracts/utils/cryptography/ECDSA.sol": `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
library ECDSA {
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        if (signature.length == 65) {
            bytes32 r; bytes32 s; uint8 v;
            assembly { r := mload(add(signature, 0x20)) s := mload(add(signature, 0x40)) v := byte(0, mload(add(signature, 0x60))) }
            return recover(hash, v, r, s);
        } else { revert ECDSAInvalidSignatureLength(signature.length); }
    }
    function recover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) revert ECDSAInvalidSignatureS(s);
        address signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert ECDSAInvalidSignature();
        return signer;
    }
}`,
};

// Store for multi-file sources during compilation
let multiFileSources: Record<string, string> = {};

function findImports(importPath: string): { contents: string } | { error: string } {
  // Handle OpenZeppelin imports
  if (importPath.startsWith("@openzeppelin/")) {
    const source = OPENZEPPELIN_SOURCES[importPath];
    if (source) {
      return { contents: source };
    }
  }
  
  // Handle local imports from multi-file sources
  // Try exact match first
  if (multiFileSources[importPath]) {
    return { contents: multiFileSources[importPath] };
  }
  
  // Try with .sol extension
  const withSol = importPath.endsWith(".sol") ? importPath : `${importPath}.sol`;
  if (multiFileSources[withSol]) {
    return { contents: multiFileSources[withSol] };
  }
  
  // Try matching by filename only (for relative imports like "../interfaces/ISettlementHook.sol")
  const filename = importPath.split("/").pop() || importPath;
  for (const [key, content] of Object.entries(multiFileSources)) {
    if (key === filename || key.endsWith(`/${filename}`)) {
      return { contents: content };
    }
  }
  
  return { error: `File not found: ${importPath}` };
}

export function compileSolidity(sourceCode: string, contractName: string): CompileResult {
  const input = {
    language: "Solidity",
    sources: {
      "contract.sol": { content: sourceCode },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode"] },
      },
    },
  };

  try {
    const output = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImports })
    );

    // Check for errors
    const errors = output.errors?.filter((e: { severity: string }) => e.severity === "error");
    if (errors?.length > 0) {
      return {
        success: false,
        errors: errors.map((e: { formattedMessage: string }) => e.formattedMessage),
      };
    }

    // Get compiled contract
    const contracts = output.contracts?.["contract.sol"];
    if (!contracts || !contracts[contractName]) {
      return {
        success: false,
        errors: [`Contract "${contractName}" not found in compiled output`],
      };
    }

    const contract = contracts[contractName];
    return {
      success: true,
      abi: contract.abi,
      bytecode: "0x" + contract.evm.bytecode.object,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Compilation failed"],
    };
  }
}

/**
 * Compiles multiple Solidity source files together
 * Returns compiled artifacts for all contracts in the bundle
 */
export function compileMultiFileSolidity(sourceFiles: SourceFile[]): MultiFileCompileResult {
  // Build sources object and populate multiFileSources for import resolution
  const sources: Record<string, { content: string }> = {};
  multiFileSources = {};
  
  for (const file of sourceFiles) {
    sources[file.filename] = { content: file.content };
    multiFileSources[file.filename] = file.content;
  }
  
  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode"] },
      },
    },
  };

  try {
    const output = JSON.parse(
      solc.compile(JSON.stringify(input), { import: findImports })
    );

    // Check for errors
    const errors = output.errors?.filter((e: { severity: string }) => e.severity === "error");
    if (errors?.length > 0) {
      // Clear multiFileSources
      multiFileSources = {};
      return {
        success: false,
        contracts: {},
        errors: errors.map((e: { formattedMessage: string }) => e.formattedMessage),
      };
    }

    // Extract compiled contracts
    const result: MultiFileCompileResult = {
      success: true,
      contracts: {},
    };

    for (const file of sourceFiles) {
      const fileContracts = output.contracts?.[file.filename];
      if (fileContracts && fileContracts[file.contractName]) {
        const contract = fileContracts[file.contractName];
        result.contracts[file.filename] = {
          contractName: file.contractName,
          bytecode: "0x" + contract.evm.bytecode.object,
          abi: contract.abi,
        };
      }
    }

    // Clear multiFileSources
    multiFileSources = {};
    return result;
  } catch (error) {
    // Clear multiFileSources
    multiFileSources = {};
    return {
      success: false,
      contracts: {},
      errors: [error instanceof Error ? error.message : "Compilation failed"],
    };
  }
}
