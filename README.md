# Qilin x402

An AI-powered platform for building, testing, and deploying x402 payment solutions on Cronos blockchain.

## Resources

| Component | Website | GitHub |
|-----------|---------|--------|
| Dashboard App | [qilinx-x402.vercel.app](https://qilinx-x402.vercel.app/) | [qilinxlabs/qilinx-x402-dashboard](https://github.com/qilinxlabs/qilinx-x402-dashboard) |
| A2A Server | [qilinx-x402-a2a-server.vercel.app](https://qilinx-x402-a2a-server.vercel.app) | [qilinxlabs/qilinx-x402-a2a-server](https://github.com/qilinxlabs/qilinx-x402-a2a-server) |
| A2A Library SDK | [npm: @qilinxlabs/a2a-cronos-x402](https://www.npmjs.com/package/@qilinxlabs/a2a-cronos-x402) | [qilinxlabs/a2a-cronos-x402](https://github.com/qilinxlabs/a2a-cronos-x402) |

## What is x402?

x402 is a payment protocol that enables HTTP 402 "Payment Required" responses with USDC payments on EVM chains. This platform provides tools to:

- **Pay** - Send x402 payments using USDC with EIP-3009 authorization
- **Build** - Deploy x402 settlement contracts and hook contracts
- **Test** - Test payment flows on Cronos Testnet

## Features

### AI Chat Assistant
Interact with an AI assistant to manage x402 payments and smart contracts using natural language. The chat interface supports:
- x402 payment discovery and execution
- Contract deployment guidance
- Payment troubleshooting

### Smart Contracts Library
Deploy x402 settlement infrastructure on Cronos Testnet:

**Settlement Router** - Deploy once per network, routes payments to hook contracts

**Hook Contracts:**
- **NFT Mint Hook** - Mint NFTs on successful payment
- **Reward Points Hook** - Award loyalty tokens on payment
- **Split Payment Hook** - Split payments between multiple recipients

### DApps Builder
Build and publish x402 payment DApps with customizable templates:
- NFT minting storefronts
- Reward points programs
- Revenue sharing applications

### Payment Management
Send x402 payments directly from the platform:
- Sign USDC authorization using EIP-3009
- Route payments through Settlement Router
- Execute hook contract logic

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **AI**: Google Gemini via AI SDK
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Cronos Testnet (Chain ID: 338)
- **Payments**: USDC with EIP-3009 (transferWithAuthorization)
- **Styling**: Tailwind CSS + shadcn/ui

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL database
- Cronos Testnet wallet with test CRO

### Installation

```bash
# Clone the repository
git clone https://github.com/0xbohu/qilinx-cronos-app.git
cd qilinx-cronos-app

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Environment Variables

See `.env.example` for required configuration:

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Authentication secret (generate with `openssl rand -base64 32`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini API key |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token |
| `POSTGRES_URL` | PostgreSQL database connection string |
| `REDIS_URL` | Redis connection string |
| `CRONOS_TESTNET_PRIVATE_KEY` | Wallet private key for testnet payments |
| `CRONOS_MAINNET_PRIVATE_KEY` | Wallet private key for mainnet payments |
| `CRONOS_DEVELOPER_PRIVATE_KEY` | Wallet private key for contract deployment |
| `RESOURCE_SERVICE_URL` | x402 A2A server URL |

## x402 Payment Flow

```
User Wallet → Sign USDC Authorization → Settlement Router → Hook Contract → Recipient
```

1. User signs EIP-3009 authorization for USDC transfer
2. Authorization sent to Settlement Router contract
3. Router executes `transferWithAuthorization` and calls hook
4. Hook performs custom logic (mint NFT, send rewards, split payment)

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Authentication pages
│   ├── (chat)/            # Main application pages
│   └── api/               # API routes
├── components/            # React components
│   ├── chat/              # Chat interface components
│   ├── contracts/         # Contract management UI
│   ├── dapps/             # DApp builder components
│   └── manage-payments/   # Payment management UI
├── contracts/             # Solidity smart contracts
├── lib/                   # Shared utilities
│   ├── ai/                # AI tools and configuration
│   ├── contracts/         # Contract deployment services
│   ├── cronos/            # Cronos network utilities
│   ├── db/                # Database schema and queries
│   └── x402/              # x402 payment services
└── public/                # Static assets
```

## License

MIT
