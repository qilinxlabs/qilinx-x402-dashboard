-- Combined Seed SQL for Contract_Template and Dapp_Template
-- Run this in Neon Dashboard
-- Updated for USDC token on Cronos Testnet

-- =====================================================
-- PART 1: Contract Templates (USDC on Cronos)
-- =====================================================

-- USDC Staking Contract Template
INSERT INTO "Contract_Template" ("id", "name", "description", "category", "soliditySourceCode", "constructorParamsSchema")
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'USDC Staking',
  'Stake USDC tokens to earn rewards over time. Users can deposit USDC tokens and receive staking rewards based on the configured APY rate.',
  'staking',
  '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title USDCStaking
 * @dev Stake USDC tokens to earn rewards
 * @notice USDC has 6 decimals
 */
contract USDCStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    uint256 public rewardRate; // Rewards per second per token staked (scaled by 1e18)
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;

    mapping(address => uint256) public userStakedBalance;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _usdcToken, uint256 _rewardRate) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        rewardRate = _rewardRate;
        lastUpdateTime = block.timestamp;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalStaked);
    }

    function earned(address account) public view returns (uint256) {
        return (userStakedBalance[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) + rewards[account];
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalStaked += amount;
        userStakedBalance[msg.sender] += amount;
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(userStakedBalance[msg.sender] >= amount, "Insufficient balance");
        totalStaked -= amount;
        userStakedBalance[msg.sender] -= amount;
        usdcToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            usdcToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
        emit RewardRateUpdated(_rewardRate);
    }

    function depositRewards(uint256 amount) external onlyOwner {
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
    }
}',
  '[
    {"name": "_usdcToken", "type": "address", "description": "Address of the USDC token contract", "defaultValue": "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C", "required": true},
    {"name": "_rewardRate", "type": "uint256", "description": "Initial reward rate per second (scaled by 1e18)", "defaultValue": "1000000000000000", "required": true}
  ]'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "soliditySourceCode" = EXCLUDED."soliditySourceCode",
  "constructorParamsSchema" = EXCLUDED."constructorParamsSchema";


-- USDC DAO Voting Contract Template
INSERT INTO "Contract_Template" ("id", "name", "description", "category", "soliditySourceCode", "constructorParamsSchema")
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012',
  'USDC DAO Voting',
  'Governance contract that allows USDC token holders to create and vote on proposals. Voting power is proportional to USDC token holdings.',
  'dao-voting',
  '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USDCGovernance
 * @dev DAO voting contract using USDC tokens for governance
 * @notice USDC has 6 decimals
 */
contract USDCGovernance is Ownable {
    IERC20 public immutable usdcToken;
    
    uint256 public proposalCount;
    uint256 public votingPeriod;
    uint256 public quorumPercentage; // Percentage scaled by 100 (e.g., 400 = 4%)

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(address _usdcToken, uint256 _votingPeriod, uint256 _quorumPercentage) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        votingPeriod = _votingPeriod;
        quorumPercentage = _quorumPercentage;
    }

    function createProposal(string calldata description) external returns (uint256) {
        require(usdcToken.balanceOf(msg.sender) > 0, "Must hold USDC to propose");
        
        proposalCount++;
        Proposal storage proposal = proposals[proposalCount];
        proposal.id = proposalCount;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalCount, msg.sender, description);
        return proposalCount;
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint256 weight = usdcToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit Voted(proposalId, msg.sender, support, weight);
    }

    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting not ended");
        require(!proposal.executed, "Already executed");
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 totalSupply = usdcToken.totalSupply();
        require(totalVotes * 10000 / totalSupply >= quorumPercentage, "Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed
    ) {
        Proposal storage p = proposals[proposalId];
        return (p.proposer, p.description, p.forVotes, p.againstVotes, p.startTime, p.endTime, p.executed);
    }

    function setVotingPeriod(uint256 _votingPeriod) external onlyOwner {
        votingPeriod = _votingPeriod;
    }

    function setQuorumPercentage(uint256 _quorumPercentage) external onlyOwner {
        quorumPercentage = _quorumPercentage;
    }
}',
  '[
    {"name": "_usdcToken", "type": "address", "description": "Address of the USDC token contract", "defaultValue": "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C", "required": true},
    {"name": "_votingPeriod", "type": "uint256", "description": "Duration of voting period in seconds", "defaultValue": "259200", "required": true},
    {"name": "_quorumPercentage", "type": "uint256", "description": "Minimum participation percentage (scaled by 100, e.g., 400 = 4%)", "defaultValue": "400", "required": true}
  ]'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "soliditySourceCode" = EXCLUDED."soliditySourceCode",
  "constructorParamsSchema" = EXCLUDED."constructorParamsSchema";


-- USDC Payment Receipt Contract Template
INSERT INTO "Contract_Template" ("id", "name", "description", "category", "soliditySourceCode", "constructorParamsSchema")
VALUES (
  'c3d4e5f6-a7b8-9012-cdef-345678901234',
  'USDC Payment Receipt',
  'Accept USDC token payments for services and generate on-chain receipts. Merchants can receive payments and customers get verifiable proof of payment.',
  'payment',
  '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title USDCPayment
 * @dev Accept USDC payments and issue on-chain receipts
 * @notice USDC has 6 decimals
 */
contract USDCPayment is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    string public merchantName;
    uint256 public receiptCount;

    struct Receipt {
        uint256 id;
        address payer;
        uint256 amount;
        string description;
        uint256 timestamp;
        bytes32 referenceId;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(address => uint256[]) public payerReceipts;

    event PaymentReceived(
        uint256 indexed receiptId,
        address indexed payer,
        uint256 amount,
        string description,
        bytes32 referenceId
    );
    event FundsWithdrawn(address indexed to, uint256 amount);

    constructor(address _usdcToken, string memory _merchantName) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
        merchantName = _merchantName;
    }

    function pay(uint256 amount, string calldata description, bytes32 referenceId) external nonReentrant returns (uint256) {
        require(amount > 0, "Amount must be greater than 0");
        
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        
        receiptCount++;
        receipts[receiptCount] = Receipt({
            id: receiptCount,
            payer: msg.sender,
            amount: amount,
            description: description,
            timestamp: block.timestamp,
            referenceId: referenceId
        });
        
        payerReceipts[msg.sender].push(receiptCount);

        emit PaymentReceived(receiptCount, msg.sender, amount, description, referenceId);
        return receiptCount;
    }

    function getReceipt(uint256 receiptId) external view returns (
        address payer,
        uint256 amount,
        string memory description,
        uint256 timestamp,
        bytes32 referenceId
    ) {
        Receipt storage r = receipts[receiptId];
        require(r.id != 0, "Receipt does not exist");
        return (r.payer, r.amount, r.description, r.timestamp, r.referenceId);
    }

    function getPayerReceiptCount(address payer) external view returns (uint256) {
        return payerReceipts[payer].length;
    }

    function getPayerReceiptIds(address payer) external view returns (uint256[] memory) {
        return payerReceipts[payer];
    }

    function verifyPayment(bytes32 referenceId, address payer, uint256 minAmount) external view returns (bool, uint256) {
        uint256[] memory ids = payerReceipts[payer];
        for (uint256 i = 0; i < ids.length; i++) {
            Receipt storage r = receipts[ids[i]];
            if (r.referenceId == referenceId && r.amount >= minAmount) {
                return (true, r.id);
            }
        }
        return (false, 0);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= usdcToken.balanceOf(address(this)), "Insufficient balance");
        usdcToken.safeTransfer(msg.sender, amount);
        emit FundsWithdrawn(msg.sender, amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No funds to withdraw");
        usdcToken.safeTransfer(msg.sender, balance);
        emit FundsWithdrawn(msg.sender, balance);
    }

    function setMerchantName(string calldata _merchantName) external onlyOwner {
        merchantName = _merchantName;
    }

    function getContractBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }
}',
  '[
    {"name": "_usdcToken", "type": "address", "description": "Address of the USDC token contract", "defaultValue": "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C", "required": true},
    {"name": "_merchantName", "type": "string", "description": "Name of the merchant or business", "defaultValue": "My Business", "required": true}
  ]'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "soliditySourceCode" = EXCLUDED."soliditySourceCode",
  "constructorParamsSchema" = EXCLUDED."constructorParamsSchema";



-- =====================================================
-- PART 2: DApp Templates (Updated for USDC)
-- =====================================================

-- USDC Staking DApp Template
INSERT INTO "Dapp_Template" ("id", "name", "description", "category", "defaultConfig")
VALUES (
  'd1a2b3c4-e5f6-7890-abcd-111111111111',
  'USDC Staking DApp',
  'A complete staking interface for USDC tokens. Users can stake tokens, view their staked balance, track earned rewards, and withdraw their stake.',
  'staking',
  '{
    "templateType": "staking",
    "theme": {
      "primaryColor": "#2775ca",
      "accentColor": "#22c55e",
      "backgroundColor": "#fafafa",
      "textColor": "#1f2937",
      "cardStyle": "elevated"
    },
    "branding": {
      "title": "USDC Staking Pool",
      "subtitle": "Stake your USDC tokens and earn rewards"
    },
    "sections": {
      "stakeForm": { "enabled": true, "title": "Stake USDC" },
      "stakedBalance": { "enabled": true, "title": "Your Staked Balance" },
      "rewards": { "enabled": true, "title": "Claimable Rewards" },
      "withdrawForm": { "enabled": true, "title": "Withdraw" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showTokenApproval": true,
      "showWalletBalance": true
    }
  }'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "defaultConfig" = EXCLUDED."defaultConfig";

-- USDC DAO Voting DApp Template
INSERT INTO "Dapp_Template" ("id", "name", "description", "category", "defaultConfig")
VALUES (
  'd2b3c4d5-f6a7-8901-bcde-222222222222',
  'USDC DAO Voting DApp',
  'A governance interface for USDC token holders. Create proposals, vote on active proposals, and track governance statistics.',
  'dao-voting',
  '{
    "templateType": "dao-voting",
    "theme": {
      "primaryColor": "#2775ca",
      "accentColor": "#f59e0b",
      "backgroundColor": "#fafafa",
      "textColor": "#1f2937",
      "cardStyle": "elevated"
    },
    "branding": {
      "title": "USDC DAO Governance",
      "subtitle": "Participate in governance decisions with your USDC tokens"
    },
    "sections": {
      "proposalList": { "enabled": true, "title": "Proposals" },
      "createProposal": { "enabled": true, "title": "New Proposal" },
      "votingStats": { "enabled": true, "title": "Governance Stats" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showTokenApproval": false,
      "showWalletBalance": true
    }
  }'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "defaultConfig" = EXCLUDED."defaultConfig";

-- USDC Payment DApp Template
INSERT INTO "Dapp_Template" ("id", "name", "description", "category", "defaultConfig")
VALUES (
  'd3c4d5e6-a7b8-9012-cdef-333333333333',
  'USDC Payment DApp',
  'A payment interface for accepting USDC tokens. Customers can make payments, view receipts, and see merchant information.',
  'payment',
  '{
    "templateType": "payment",
    "theme": {
      "primaryColor": "#2775ca",
      "accentColor": "#3b82f6",
      "backgroundColor": "#fafafa",
      "textColor": "#1f2937",
      "cardStyle": "elevated"
    },
    "branding": {
      "title": "USDC Payments",
      "subtitle": "Fast and secure payments with USDC tokens"
    },
    "sections": {
      "paymentForm": { "enabled": true, "title": "Make Payment" },
      "receiptHistory": { "enabled": true, "title": "Payment History" },
      "merchantInfo": { "enabled": true, "title": "Merchant" }
    },
    "features": {
      "showContractInfo": true,
      "showNetworkBadge": true,
      "showTokenApproval": true,
      "showWalletBalance": true
    }
  }'::json
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "defaultConfig" = EXCLUDED."defaultConfig";
