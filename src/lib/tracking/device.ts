// Ultra-lightweight user-agent parser (no dependencies)
// Provides just enough info for audit tracking (not a full ua-parser)

import type { DeviceInfo, DeviceType } from './types';

const detectDeviceType = (ua: string): DeviceType => {
  const test = ua.toLowerCase();

  if (/bot|crawler|spider|crawl|slurp|mediapartners|facebookexternalhit/.test(test)) {
    return 'bot';
  }

  if (/ipad|tablet|(android(?!.*mobile))|xoom|sch-i800|playbook|kindle|silk/.test(test)) {
    return 'tablet';
  }

  if (
    /iphone|ipod|android.*mobile|blackberry|opera mini|iemobile|webos|windows phone|mobile/.test(test)
  ) {
    return 'mobile';
  }

  if (/windows|macintosh|x11|ubuntu|linux/.test(test)) {
    return 'desktop';
  }

  return 'unknown';
};

const detectOS = (ua: string): string | null => {
  const test = ua;

  // Windows
  const win = test.match(/Windows NT (\d+\.?\d*)/);
  if (win) {
    const versionMap: Record<string, string> = {
      '10.0': '11/10',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
    };
    return `Windows ${versionMap[win[1]] ?? win[1]}`;
  }

  // macOS
  const mac = test.match(/Mac OS X (\d+[_.]\d+([_.]\d+)?)/);
  if (mac) return `macOS ${mac[1].replace(/_/g, '.')}`;

  // Android
  const and = test.match(/Android (\d+\.?\d*)/);
  if (and) return `Android ${and[1]}`;

  // iOS
  const ios = test.match(/OS (\d+[_.]\d+([_.]\d+)?) like Mac OS X/);
  if (ios) return `iOS ${ios[1].replace(/_/g, '.')}`;

  // Linux
  if (/X11|Ubuntu|Linux/.test(test)) return 'Linux';

  return null;
};

const detectBrowser = (ua: string): string | null => {
  const test = ua;

  // Edge (must check before Chrome)
  const edge = test.match(/Edg\/(\d+\.?\d*)/);
  if (edge) return `Edge ${edge[1]}`;

  // Opera
  const opera = test.match(/OPR\/(\d+\.?\d*)/);
  if (opera) return `Opera ${opera[1]}`;

  // Chrome
  const chrome = test.match(/Chrome\/(\d+\.?\d*)/);
  if (chrome) return `Chrome ${chrome[1]}`;

  // Safari (must check after Chrome)
  const safari = test.match(/Version\/(\d+\.?\d*).*Safari/);
  if (safari) return `Safari ${safari[1]}`;

  // Firefox
  const ff = test.match(/Firefox\/(\d+\.?\d*)/);
  if (ff) return `Firefox ${ff[1]}`;

  return null;
};

export const parseDevice = (userAgent: string | null | undefined): DeviceInfo => {
  const ua = userAgent ?? '';
  return {
    device_type: detectDeviceType(ua),
    operating_system: detectOS(ua),
    browser: detectBrowser(ua),
    user_agent: ua || null,
  };
};
