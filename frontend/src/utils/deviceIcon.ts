export function getDeviceIcon(deviceType: string | null, vendor: string | null): string {
  if (deviceType) {
    const t = deviceType.toLowerCase();
    if (t.includes('router') || t.includes('gateway')) return '🌐';
    if (t.includes('phone') || t.includes('mobile')) return '📱';
    if (t.includes('computer') || t.includes('pc') || t.includes('laptop')) return '💻';
    if (t.includes('tablet')) return '📱';
    if (t.includes('printer')) return '🖨️';
    if (t.includes('tv') || t.includes('smart')) return '📺';
    if (t.includes('camera')) return '📷';
    if (t.includes('speaker') || t.includes('audio')) return '🔊';
    if (t.includes('watch')) return '⌚';
    if (t.includes('console') || t.includes('game')) return '🎮';
    if (t.includes('iot') || t.includes('smart')) return '🔌';
  }

  if (vendor) {
    const v = vendor.toLowerCase();
    if (v.includes('tp-link') || v.includes('netgear') || v.includes('cisco') || v.includes('router')) return '🌐';
    if (v.includes('apple') || v.includes('samsung') || v.includes('xiaomi') || v.includes('huawei')) return '📱';
    if (v.includes('intel') || v.includes('dell') || v.includes('hp') || v.includes('lenovo') || v.includes('asus')) return '💻';
    if (v.includes('sony') || v.includes('lg') || v.includes('philips')) return '📺';
    if (v.includes('canon') || v.includes('epson') || v.includes('brother')) return '🖨️';
    if (v.includes('amazon') || v.includes('google') || v.includes('echo')) return '🔌';
    if (v.includes('nintendo') || v.includes('playstation') || v.includes('xbox')) return '🎮';
  }

  return '📟';
}
