import { Token } from '../types';

export const DEFAULT_TOKENS: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'OPN',
    name: 'OPNToken',
    decimals: 18,
    logoURI: 'https://i.ibb.co/dN1sMhw/logo.jpg'
  },
  {
    address: process.env.REACT_APP_WETH_ADDRESS || '',
    symbol: 'wOPN',
    name: 'Wrapped OPN',
    decimals: 18,
    logoURI: 'https://i.ibb.co/dN1sMhw/logo.jpg'
  },
  {
    address: process.env.REACT_APP_USDC_ADDRESS || '',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  },
  {
    address: process.env.REACT_APP_DAI_ADDRESS || '',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png'
  }
];