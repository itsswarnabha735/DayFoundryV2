/**
 * Deep Links and Quick Actions Utility
 * 
 * Provides functions for generating URLs and configurations for:
 * - iOS Shortcuts
 * - Android App Shortcuts
 * - Web App Manifest shortcuts
 * - Widget URLs
 */

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  deepLinkUrl: string;
  shortUrl: string;
}

// Deep link URL schemes
const DEEP_LINK_SCHEMES = {
  custom: 'dayfoundry://',
  web: window.location.origin,
  hash: '#action=',
  query: '?action='
};

/**
 * Generate deep link URLs for quick actions
 */
export const generateDeepLinks = () => {
  const baseUrl = window.location.origin;
  
  return {
    quickCapture: {
      custom: `${DEEP_LINK_SCHEMES.custom}quick-capture`,
      web: `${baseUrl}${DEEP_LINK_SCHEMES.query}quick-capture`,
      hash: `${baseUrl}${DEEP_LINK_SCHEMES.hash}quick-capture`
    },
    startFocus: {
      custom: `${DEEP_LINK_SCHEMES.custom}start-focus`,
      web: `${baseUrl}${DEEP_LINK_SCHEMES.query}start-focus`,
      hash: `${baseUrl}${DEEP_LINK_SCHEMES.hash}start-focus`
    },
    addOutcome: {
      custom: `${DEEP_LINK_SCHEMES.custom}add-outcome`,
      web: `${baseUrl}${DEEP_LINK_SCHEMES.query}add-outcome`,
      hash: `${baseUrl}${DEEP_LINK_SCHEMES.hash}add-outcome`
    }
  };
};

/**
 * Quick Actions Configuration
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'quick-capture',
    title: 'Quick Capture',
    description: 'Instantly capture a task or idea',
    icon: '✍️',
    deepLinkUrl: generateDeepLinks().quickCapture.web,
    shortUrl: generateDeepLinks().quickCapture.hash
  },
  {
    id: 'start-focus',
    title: 'Start Focus',
    description: 'Begin a focused work session',
    icon: '🎯',
    deepLinkUrl: generateDeepLinks().startFocus.web,
    shortUrl: generateDeepLinks().startFocus.hash
  },
  {
    id: 'add-outcome',
    title: 'Add Outcome',
    description: 'Define a new daily outcome',
    icon: '🎯',
    deepLinkUrl: generateDeepLinks().addOutcome.web,
    shortUrl: generateDeepLinks().addOutcome.hash
  }
];

/**
 * Generate iOS Shortcuts configuration
 */
export const generateIOSShortcuts = () => {
  const links = generateDeepLinks();
  
  return {
    shortcuts: [
      {
        name: "Quick Capture - Day Foundry",
        url: links.quickCapture.custom,
        webUrl: links.quickCapture.web,
        systemImageName: "square.and.pencil",
        backgroundColor: "#2563EB"
      },
      {
        name: "Start Focus - Day Foundry", 
        url: links.startFocus.custom,
        webUrl: links.startFocus.web,
        systemImageName: "target",
        backgroundColor: "#2563EB"
      },
      {
        name: "Add Outcome - Day Foundry",
        url: links.addOutcome.custom, 
        webUrl: links.addOutcome.web,
        systemImageName: "flag.circle",
        backgroundColor: "#2563EB"
      }
    ]
  };
};

/**
 * Generate Android App Shortcuts configuration
 */
export const generateAndroidShortcuts = () => {
  const links = generateDeepLinks();
  
  return {
    shortcuts: [
      {
        shortcutId: "quick_capture",
        shortLabel: "Capture",
        longLabel: "Quick Capture",
        icon: "@drawable/ic_edit",
        intent: {
          action: "android.intent.action.VIEW",
          data: links.quickCapture.web
        }
      },
      {
        shortcutId: "start_focus",
        shortLabel: "Focus",
        longLabel: "Start Focus",
        icon: "@drawable/ic_target", 
        intent: {
          action: "android.intent.action.VIEW",
          data: links.startFocus.web
        }
      },
      {
        shortcutId: "add_outcome",
        shortLabel: "Outcome",
        longLabel: "Add Outcome",
        icon: "@drawable/ic_flag",
        intent: {
          action: "android.intent.action.VIEW",
          data: links.addOutcome.web
        }
      }
    ]
  };
};

/**
 * Generate Web App Manifest shortcuts
 */
export const generateWebAppManifestShortcuts = () => {
  const links = generateDeepLinks();
  
  return {
    shortcuts: [
      {
        name: "Quick Capture",
        short_name: "Capture", 
        description: "Instantly capture a task or idea",
        url: links.quickCapture.hash,
        icons: [
          {
            src: "/icons/capture-96x96.png",
            sizes: "96x96",
            type: "image/png"
          }
        ]
      },
      {
        name: "Start Focus",
        short_name: "Focus",
        description: "Begin a focused work session", 
        url: links.startFocus.hash,
        icons: [
          {
            src: "/icons/focus-96x96.png",
            sizes: "96x96", 
            type: "image/png"
          }
        ]
      },
      {
        name: "Add Outcome",
        short_name: "Outcome",
        description: "Define a new daily outcome",
        url: links.addOutcome.hash,
        icons: [
          {
            src: "/icons/outcome-96x96.png",
            sizes: "96x96",
            type: "image/png" 
          }
        ]
      }
    ]
  };
};

/**
 * Generate widget URLs for home screen widgets
 */
export const generateWidgetUrls = () => {
  const links = generateDeepLinks();
  
  return {
    quickActions: {
      capture: links.quickCapture.web,
      focus: links.startFocus.web, 
      outcome: links.addOutcome.web
    },
    // URLs that can be embedded in widgets
    embedUrls: {
      capture: `${links.quickCapture.web}&widget=true`,
      focus: `${links.startFocus.web}&widget=true`,
      outcome: `${links.addOutcome.web}&widget=true`
    }
  };
};

/**
 * Generate instructions for setting up shortcuts
 */
export const generateShortcutInstructions = () => {
  const iosShortcuts = generateIOSShortcuts();
  const androidShortcuts = generateAndroidShortcuts();
  const webShortcuts = generateWebAppManifestShortcuts();
  
  return {
    ios: {
      title: "iOS Shortcuts Setup",
      instructions: [
        "1. Open the Shortcuts app on your iPhone",
        "2. Tap the '+' to create a new shortcut",
        "3. Add 'Open URL' action",
        "4. Use these URLs for each action:",
        ...iosShortcuts.shortcuts.map(s => `   • ${s.name}: ${s.webUrl}`),
        "5. Add to Home Screen for quick access"
      ],
      shortcuts: iosShortcuts.shortcuts
    },
    android: {
      title: "Android App Shortcuts",
      instructions: [
        "1. Long press the Day Foundry app icon",
        "2. Select from available shortcuts:",
        ...androidShortcuts.shortcuts.map(s => `   • ${s.longLabel}`),
        "3. Drag shortcuts to home screen",
        "4. Or use browser bookmarks with these URLs:",
        ...androidShortcuts.shortcuts.map(s => `   • ${s.longLabel}: ${s.intent.data}`)
      ],
      shortcuts: androidShortcuts.shortcuts
    },
    web: {
      title: "Web App Shortcuts",
      instructions: [
        "1. Open Day Foundry in your browser",
        "2. Add to Home Screen (iOS Safari / Android Chrome)",
        "3. Available shortcuts will appear automatically:",
        ...webShortcuts.shortcuts.map(s => `   • ${s.name}: ${s.description}`),
        "4. Or bookmark these URLs:",
        ...webShortcuts.shortcuts.map(s => `   • ${s.name}: ${window.location.origin}${s.url}`)
      ],
      shortcuts: webShortcuts.shortcuts
    }
  };
};

/**
 * Test deep link functionality
 */
export const testDeepLinks = () => {
  const links = generateDeepLinks();
  
  console.group('Day Foundry Deep Links Test');
  console.log('Available deep links:', links);
  console.log('Quick Actions:', QUICK_ACTIONS);
  console.log('Global quick actions available:', window.dayFoundryQuickActions);
  console.groupEnd();
  
  return {
    links,
    actions: QUICK_ACTIONS,
    globalActions: window.dayFoundryQuickActions
  };
};

/**
 * Copy deep link URLs to clipboard
 */
export const copyDeepLinksToClipboard = async () => {
  const links = generateDeepLinks();
  const instructions = generateShortcutInstructions();
  
  const content = `
Day Foundry Quick Actions - Deep Links

Quick Capture: ${links.quickCapture.web}
Start Focus: ${links.startFocus.web}
Add Outcome: ${links.addOutcome.web}

${instructions.ios.instructions.join('\n')}

${instructions.android.instructions.join('\n')}

${instructions.web.instructions.join('\n')}
  `.trim();
  
  try {
    await navigator.clipboard.writeText(content);
    return { success: true, message: 'Deep links copied to clipboard!' };
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return { success: false, message: 'Failed to copy to clipboard' };
  }
};

// Export for global access during development
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.dayFoundryDeepLinks = {
    generateDeepLinks,
    generateWidgetUrls,
    testDeepLinks,
    copyDeepLinksToClipboard,
    QUICK_ACTIONS
  };
}