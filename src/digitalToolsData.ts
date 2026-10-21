import { DigitalToolItem } from './types';

export const digitalToolsData: DigitalToolItem[] = [
  {
    id: 'tool-1',
    name: 'V2RayN (Windows)',
    category: 'Clients',
    description: 'Popular GUI client for Windows supporting VMess, VLESS, Trojan, Shadowsocks.',
    url: 'https://github.com/2dust/v2rayN/releases',
    isFree: true,
    tags: ['Windows', 'V2Ray', 'GUI']
  },
  {
    id: 'tool-2',
    name: 'v2rayNG (Android)',
    category: 'Clients',
    description: 'V2Ray client for Android devices with custom routing rules.',
    url: 'https://github.com/2dust/v2rayNG/releases',
    isFree: true,
    tags: ['Android', 'Mobile', 'V2Ray']
  },
  {
    id: 'tool-3',
    name: 'NekoBox for Android',
    category: 'Clients',
    description: 'Universal proxy client for Android based on sing-box.',
    url: 'https://github.com/MatsuriDayo/NekoBoxForAndroid/releases',
    isFree: true,
    tags: ['Android', 'Sing-Box', 'Clash']
  },
  {
    id: 'tool-4',
    name: 'FoxRay (iOS / macOS)',
    category: 'Clients',
    description: 'Modern iOS/macOS proxy client supporting VLESS, VMess, Trojan, TUIC, Hysteria2.',
    url: 'https://apps.apple.com/app/foxray/id6448898396',
    isFree: true,
    tags: ['iOS', 'macOS', 'V2Ray']
  },
  {
    id: 'tool-5',
    name: 'Sing-Box Core',
    category: 'Core',
    description: 'The universal proxy platform supporting all modern protocols.',
    url: 'https://github.com/SagerNet/sing-box/releases',
    isFree: true,
    tags: ['Core', 'Sing-Box', 'Multiplatform']
  }
];
