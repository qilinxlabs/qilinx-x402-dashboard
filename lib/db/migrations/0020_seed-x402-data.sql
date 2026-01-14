-- Seed x402 Contract Templates and DApp Templates
-- Run this after migration 0018_x402-contract-templates.sql

-- ============================================================================
-- x402 Contract Templates
-- ============================================================================

-- 1. NFT Mint Hook Bundle
INSERT INTO "Contract_Template" (
  "id", "name", "description", "category", "soliditySourceCode", 
  "sourceFiles", "deploymentConfig", "constructorParamsSchema", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 NFT Mint Hook',
  'Pay-to-mint NFT using x402 settlement. Automatically mints NFT after payment verification. Includes NFTMintHook and RandomNFT contracts.',
  'x402-settlement',
  '// See sourceFiles for full source code',
  '[
    {
      "filename": "ISettlementHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\ninterface ISettlementHook {\n    function execute(\n        bytes32 contextKey,\n        address payer,\n        address token,\n        uint256 amount,\n        bytes32 salt,\n        address payTo,\n        address facilitator,\n        bytes calldata data\n    ) external returns (bytes memory result);\n}",
      "isMain": false,
      "contractName": "ISettlementHook"
    },
    {
      "filename": "NFTMintHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {IERC721} from \"@openzeppelin/contracts/token/ERC721/IERC721.sol\";\nimport {IERC20} from \"@openzeppelin/contracts/token/ERC20/IERC20.sol\";\nimport {SafeERC20} from \"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol\";\nimport {ISettlementHook} from \"./ISettlementHook.sol\";\n\ncontract NFTMintHook is ISettlementHook {\n    using SafeERC20 for IERC20;\n    address public immutable settlementRouter;\n    struct MintConfig { address nftContract; }\n    event NFTMinted(bytes32 indexed contextKey, address indexed nftContract, address indexed recipient);\n    event PaymentTransferred(bytes32 indexed contextKey, address indexed payTo, uint256 amount);\n    error OnlyRouter();\n    error InvalidAddress();\n    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }\n    constructor(address _settlementRouter) { require(_settlementRouter != address(0), \"Invalid router\"); settlementRouter = _settlementRouter; }\n    function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) external onlyRouter returns (bytes memory) {\n        MintConfig memory config = abi.decode(data, (MintConfig));\n        if (config.nftContract == address(0)) revert InvalidAddress();\n        if (payTo == address(0)) revert InvalidAddress();\n        IERC20(token).safeTransferFrom(settlementRouter, payTo, amount);\n        emit PaymentTransferred(contextKey, payTo, amount);\n        _safeMint(config.nftContract, payer);\n        emit NFTMinted(contextKey, config.nftContract, payer);\n        return abi.encode(config.nftContract);\n    }\n    function _safeMint(address nftContract, address to) internal {\n        (bool success, bytes memory returnData) = nftContract.call(abi.encodeWithSignature(\"mint(address)\", to));\n        if (!success) { if (returnData.length > 0) { assembly { let s := mload(returnData) revert(add(32, returnData), s) } } else { revert(\"NFT mint failed\"); } }\n    }\n}",
      "isMain": true,
      "contractName": "NFTMintHook"
    },
    {
      "filename": "RandomNFT.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {ERC721} from \"@openzeppelin/contracts/token/ERC721/ERC721.sol\";\n\ncontract RandomNFT is ERC721 {\n    uint256 public constant MAX_SUPPLY = 10000;\n    address public minter;\n    uint256 private _nextTokenId;\n    event MinterSet(address indexed minter);\n    error OnlyMinter();\n    error MaxSupplyReached();\n    constructor(address _minter) ERC721(\"X402 Random NFT\", \"X402RNFT\") { require(_minter != address(0), \"Invalid minter\"); minter = _minter; emit MinterSet(_minter); }\n    function mint(address to) external { if (msg.sender != minter) revert OnlyMinter(); if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached(); uint256 tokenId = _nextTokenId++; _safeMint(to, tokenId); }\n    function totalSupply() external view returns (uint256) { return _nextTokenId; }\n    function remainingSupply() external view returns (uint256) { return MAX_SUPPLY - _nextTokenId; }\n}",
      "isMain": false,
      "contractName": "RandomNFT"
    }
  ]'::jsonb,
  '{
    "deploymentOrder": ["NFTMintHook.sol", "RandomNFT.sol"],
    "dependencies": {
      "NFTMintHook.sol": {
        "constructorParams": [{"paramName": "_settlementRouter", "externalAddress": true, "description": "x402 SettlementRouter contract address on Cronos"}]
      },
      "RandomNFT.sol": {
        "constructorParams": [{"paramName": "_minter", "sourceContract": "NFTMintHook.sol"}]
      }
    }
  }'::jsonb,
  '[{"name": "_settlementRouter", "type": "address", "description": "x402 SettlementRouter contract address", "required": true}]'::jsonb,
  NOW()
);

-- 2. Reward Points Hook Bundle
INSERT INTO "Contract_Template" (
  "id", "name", "description", "category", "soliditySourceCode", 
  "sourceFiles", "deploymentConfig", "constructorParamsSchema", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 Reward Points Hook',
  'Pay-to-earn loyalty rewards using x402 settlement. Distributes reward tokens after payment. Includes RewardHook and RewardToken contracts.',
  'x402-settlement',
  '// See sourceFiles for full source code',
  '[
    {
      "filename": "ISettlementHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\ninterface ISettlementHook {\n    function execute(\n        bytes32 contextKey,\n        address payer,\n        address token,\n        uint256 amount,\n        bytes32 salt,\n        address payTo,\n        address facilitator,\n        bytes calldata data\n    ) external returns (bytes memory result);\n}",
      "isMain": false,
      "contractName": "ISettlementHook"
    },
    {
      "filename": "RewardHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {IERC20} from \"@openzeppelin/contracts/token/ERC20/IERC20.sol\";\nimport {SafeERC20} from \"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol\";\nimport {ISettlementHook} from \"./ISettlementHook.sol\";\n\ninterface IRewardToken { function distribute(address to, uint256 amount) external; }\n\ncontract RewardHook is ISettlementHook {\n    using SafeERC20 for IERC20;\n    address public immutable settlementRouter;\n    uint256 public constant REWARD_RATE = 1000;\n    uint256 public constant MAX_REWARD_AMOUNT = 100_000;\n    struct RewardConfig { address rewardToken; }\n    event RewardDistributed(bytes32 indexed contextKey, address indexed payer, address indexed payTo, address rewardToken, uint256 paymentAmount, uint256 rewardPoints);\n    error OnlyRouter();\n    error InvalidAddress();\n    error RewardDistributionFailed();\n    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }\n    constructor(address _settlementRouter) { require(_settlementRouter != address(0), \"Invalid router address\"); settlementRouter = _settlementRouter; }\n    function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes32 salt, address payTo, address facilitator, bytes calldata data) external onlyRouter returns (bytes memory) {\n        RewardConfig memory config = abi.decode(data, (RewardConfig));\n        if (config.rewardToken == address(0)) revert InvalidAddress();\n        if (payTo == address(0)) revert InvalidAddress();\n        IERC20(token).safeTransferFrom(settlementRouter, payTo, amount);\n        uint256 rewardableAmount = amount > MAX_REWARD_AMOUNT ? MAX_REWARD_AMOUNT : amount;\n        uint256 rewardPoints;\n        unchecked { rewardPoints = (rewardableAmount * REWARD_RATE * 10**18) / 100_000; }\n        try IRewardToken(config.rewardToken).distribute(payer, rewardPoints) {\n            emit RewardDistributed(contextKey, payer, payTo, config.rewardToken, amount, rewardPoints);\n        } catch { revert RewardDistributionFailed(); }\n        return abi.encode(rewardPoints);\n    }\n}",
      "isMain": true,
      "contractName": "RewardHook"
    },
    {
      "filename": "RewardToken.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {ERC20} from \"@openzeppelin/contracts/token/ERC20/ERC20.sol\";\n\ncontract RewardToken is ERC20 {\n    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;\n    address public immutable rewardHook;\n    event RewardsDistributed(address indexed to, uint256 amount);\n    error OnlyRewardHook();\n    error InsufficientRewards();\n    constructor(address _hook) ERC20(\"X402 Reward Points\", \"X402RP\") { require(_hook != address(0), \"Invalid hook address\"); rewardHook = _hook; _mint(address(this), MAX_SUPPLY); }\n    function distribute(address to, uint256 amount) external { if (msg.sender != rewardHook) revert OnlyRewardHook(); if (balanceOf(address(this)) < amount) revert InsufficientRewards(); _transfer(address(this), to, amount); emit RewardsDistributed(to, amount); }\n    function remainingRewards() external view returns (uint256) { return balanceOf(address(this)); }\n}",
      "isMain": false,
      "contractName": "RewardToken"
    }
  ]'::jsonb,
  '{
    "deploymentOrder": ["RewardHook.sol", "RewardToken.sol"],
    "dependencies": {
      "RewardHook.sol": {
        "constructorParams": [{"paramName": "_settlementRouter", "externalAddress": true, "description": "x402 SettlementRouter contract address on Cronos"}]
      },
      "RewardToken.sol": {
        "constructorParams": [{"paramName": "_hook", "sourceContract": "RewardHook.sol"}]
      }
    }
  }'::jsonb,
  '[{"name": "_settlementRouter", "type": "address", "description": "x402 SettlementRouter contract address", "required": true}]'::jsonb,
  NOW()
);

-- 3. Transfer Hook (Split Payment)
INSERT INTO "Contract_Template" (
  "id", "name", "description", "category", "soliditySourceCode", 
  "sourceFiles", "deploymentConfig", "constructorParamsSchema", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 Transfer Hook',
  'Simple and distributed payments with facilitator fee support. Supports single transfers and multi-recipient splits by percentage.',
  'x402-settlement',
  '// See sourceFiles for full source code',
  '[
    {
      "filename": "ISettlementHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\ninterface ISettlementHook {\n    function execute(\n        bytes32 contextKey,\n        address payer,\n        address token,\n        uint256 amount,\n        bytes32 salt,\n        address payTo,\n        address facilitator,\n        bytes calldata data\n    ) external returns (bytes memory result);\n}",
      "isMain": false,
      "contractName": "ISettlementHook"
    },
    {
      "filename": "TransferHook.sol",
      "content": "// SPDX-License-Identifier: Apache-2.0\npragma solidity ^0.8.20;\n\nimport {IERC20} from \"@openzeppelin/contracts/token/ERC20/IERC20.sol\";\nimport {SafeERC20} from \"@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol\";\nimport {ISettlementHook} from \"./ISettlementHook.sol\";\n\ncontract TransferHook is ISettlementHook {\n    using SafeERC20 for IERC20;\n    struct Split { address recipient; uint16 bips; }\n    address public immutable settlementRouter;\n    event Transfer(bytes32 indexed contextKey, address indexed recipient, uint256 amount);\n    event DistributedTransfer(bytes32 indexed contextKey, uint256 totalAmount, uint256 recipientCount);\n    error OnlyRouter();\n    error InvalidRouterAddress();\n    error EmptySplits();\n    error InvalidTotalBips(uint256 totalBips);\n    error InvalidRecipient(address recipient);\n    error InvalidBips(uint16 bips);\n    modifier onlyRouter() { if (msg.sender != settlementRouter) revert OnlyRouter(); _; }\n    constructor(address _settlementRouter) { if (_settlementRouter == address(0)) revert InvalidRouterAddress(); settlementRouter = _settlementRouter; }\n    function execute(bytes32 contextKey, address, address token, uint256 amount, bytes32, address payTo, address, bytes calldata data) external onlyRouter returns (bytes memory) {\n        if (payTo == address(0)) revert InvalidRecipient(address(0));\n        if (data.length == 0) { return _executeSimpleTransfer(contextKey, token, amount, payTo); }\n        return _executeDistributedTransfer(contextKey, token, amount, payTo, data);\n    }\n    function _executeSimpleTransfer(bytes32 contextKey, address token, uint256 amount, address recipient) private returns (bytes memory) {\n        IERC20(token).safeTransferFrom(settlementRouter, recipient, amount);\n        emit Transfer(contextKey, recipient, amount);\n        return abi.encode(recipient, amount);\n    }\n    function _executeDistributedTransfer(bytes32 contextKey, address token, uint256 amount, address payTo, bytes calldata data) private returns (bytes memory) {\n        Split[] memory splits = abi.decode(data, (Split[]));\n        if (splits.length == 0) revert EmptySplits();\n        uint256 totalBips = 0;\n        for (uint256 i = 0; i < splits.length; i++) {\n            if (splits[i].recipient == address(0)) revert InvalidRecipient(address(0));\n            if (splits[i].bips == 0) revert InvalidBips(0);\n            totalBips += splits[i].bips;\n        }\n        if (totalBips > 10000) revert InvalidTotalBips(totalBips);\n        uint256 remaining = amount;\n        for (uint256 i = 0; i < splits.length; i++) {\n            uint256 splitAmount = (amount * splits[i].bips) / 10000;\n            IERC20(token).safeTransferFrom(settlementRouter, splits[i].recipient, splitAmount);\n            remaining -= splitAmount;\n            emit Transfer(contextKey, splits[i].recipient, splitAmount);\n        }\n        uint256 recipientCount = splits.length;\n        if (remaining > 0) {\n            IERC20(token).safeTransferFrom(settlementRouter, payTo, remaining);\n            emit Transfer(contextKey, payTo, remaining);\n            recipientCount += 1;\n        }\n        emit DistributedTransfer(contextKey, amount, recipientCount);\n        return abi.encode(recipientCount, amount);\n    }\n}",
      "isMain": true,
      "contractName": "TransferHook"
    }
  ]'::jsonb,
  '{
    "deploymentOrder": ["TransferHook.sol"],
    "dependencies": {
      "TransferHook.sol": {
        "constructorParams": [{"paramName": "_settlementRouter", "externalAddress": true, "description": "x402 SettlementRouter contract address on Cronos"}]
      }
    }
  }'::jsonb,
  '[{"name": "_settlementRouter", "type": "address", "description": "x402 SettlementRouter contract address", "required": true}]'::jsonb,
  NOW()
);

-- ============================================================================
-- x402 DApp Templates
-- ============================================================================

-- 1. NFT Mint DApp Template
INSERT INTO "Dapp_Template" (
  "id", "name", "description", "category", "defaultConfig", "previewImageUrl", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 NFT Mint DApp',
  'Pay-to-mint NFT application with collection stats. Users can pay with USDC and automatically receive an NFT.',
  'x402-settlement',
  '{
    "templateType": "x402-nft-mint",
    "theme": {
      "primaryColor": "#f97316",
      "accentColor": "#10b981",
      "backgroundColor": "#fff7ed",
      "textColor": "#1f2937",
      "cardStyle": "bordered"
    },
    "branding": {
      "title": "NFT Mint",
      "subtitle": "Pay & mint your NFT instantly"
    },
    "sections": {
      "paymentButton": { "enabled": true, "title": "Pay & Mint NFT", "amount": "0.1" },
      "contractStats": { "enabled": true, "title": "Collection Stats" },
      "transactionHistory": { "enabled": true, "title": "Recent Mints" },
      "walletInfo": { "enabled": true, "title": "Your Wallet" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showUsdcApproval": false,
      "showWalletBalance": true
    },
    "x402Config": {
      "settlementRouterAddress": "",
      "hookAddress": "",
      "facilitatorFee": "0",
      "defaultPaymentAmount": "0.1"
    }
  }'::jsonb,
  '/images/dapp-templates/x402-nft-mint.png',
  NOW()
);

-- 2. Reward Points DApp Template
INSERT INTO "Dapp_Template" (
  "id", "name", "description", "category", "defaultConfig", "previewImageUrl", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 Reward Points DApp',
  'Pay-to-earn loyalty rewards application. Users earn reward tokens for each payment made.',
  'x402-settlement',
  '{
    "templateType": "x402-reward-points",
    "theme": {
      "primaryColor": "#eab308",
      "accentColor": "#15803d",
      "backgroundColor": "#fef3c7",
      "textColor": "#1f2937",
      "cardStyle": "bordered"
    },
    "branding": {
      "title": "Earn Rewards",
      "subtitle": "Pay & earn loyalty points"
    },
    "sections": {
      "paymentButton": { "enabled": true, "title": "Pay & Earn Points", "amount": "0.1" },
      "contractStats": { "enabled": true, "title": "Reward Pool Stats" },
      "transactionHistory": { "enabled": true, "title": "Your Rewards" },
      "walletInfo": { "enabled": true, "title": "Your Balance" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showUsdcApproval": false,
      "showWalletBalance": true
    },
    "x402Config": {
      "settlementRouterAddress": "",
      "hookAddress": "",
      "facilitatorFee": "0",
      "defaultPaymentAmount": "0.1"
    }
  }'::jsonb,
  '/images/dapp-templates/x402-reward-points.png',
  NOW()
);

-- 3. Split Payment DApp Template
INSERT INTO "Dapp_Template" (
  "id", "name", "description", "category", "defaultConfig", "previewImageUrl", "createdAt"
) VALUES (
  gen_random_uuid(),
  'x402 Split Payment DApp',
  'Configurable multi-recipient payment distribution. Automatically splits payments to multiple addresses by percentage.',
  'x402-settlement',
  '{
    "templateType": "x402-split-payment",
    "theme": {
      "primaryColor": "#3b82f6",
      "accentColor": "#10b981",
      "backgroundColor": "#f0f9ff",
      "textColor": "#1f2937",
      "cardStyle": "default"
    },
    "branding": {
      "title": "Split Payment",
      "subtitle": "Distribute payments to multiple recipients"
    },
    "sections": {
      "paymentButton": { "enabled": true, "title": "Pay & Split", "amount": "0.1" },
      "contractStats": { "enabled": false, "title": "" },
      "transactionHistory": { "enabled": true, "title": "Payment History" },
      "walletInfo": { "enabled": true, "title": "Your Wallet" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showUsdcApproval": false,
      "showWalletBalance": true
    },
    "x402Config": {
      "settlementRouterAddress": "",
      "hookAddress": "",
      "facilitatorFee": "0",
      "defaultPaymentAmount": "0.1"
    }
  }'::jsonb,
  '/images/dapp-templates/x402-split-payment.png',
  NOW()
);
