/**
 * Boot Sequence Module
 * Simulates BIOS/OS boot animation
 */

// ASCII Logo
const LOGO = `
████████╗██╗  ██╗███████╗
╚══██╔══╝██║  ██║██╔════╝
   ██║   ███████║█████╗
   ██║   ██╔══██║██╔══╝
   ██║   ██║  ██║███████╗
   ╚═╝   ╚═╝  ╚═╝╚══════╝

██╗      █████╗ ███████╗████████╗
██║     ██╔══██╗██╔════╝╚══██╔══╝
██║     ███████║███████╗   ██║
██║     ██╔══██║╚════██║   ██║
███████╗██║  ██║███████║   ██║
╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝

███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗
██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║
███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║
╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║
███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗
╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
`;

// Boot messages
const BOOT_MESSAGES = [
  { text: 'SENTINEL OS v4.0.1', delay: 200 },
  { text: 'Copyright (c) 2077 Wasteland Technologies', delay: 100 },
  { text: '', delay: 200 },
  { text: 'Initializing hardware...', delay: 300 },
  { text: 'CPU: AMD Ryzen 9 7950X3D [SALVAGED]', delay: 150 },
  { text: 'RAM: 64GB DDR5 [32GB FUNCTIONAL]', delay: 150 },
  { text: 'STORAGE: 2TB NVMe [SECTOR ERRORS: 2847]', delay: 150 },
  { text: 'NETWORK: MESH-NET ADAPTER [SIGNAL WEAK]', delay: 150 },
  { text: '', delay: 100 },
  { text: 'Loading kernel modules...', delay: 400 },
  { text: '  [OK] signal_interceptor.ko', delay: 100 },
  { text: '  [OK] mesh_network.ko', delay: 100 },
  { text: '  [OK] crypto_suite.ko', delay: 100 },
  { text: '  [OK] ai_analyzer.ko', delay: 100 },
  { text: '  [WARN] radiation_shield.ko - degraded', delay: 200 },
  { text: '', delay: 100 },
  { text: 'Establishing secure connection...', delay: 500 },
  { text: 'Syncing with mesh network...', delay: 400 },
  { text: 'Calibrating signal filters...', delay: 300 },
  { text: '', delay: 100 },
  { text: 'System ready.', delay: 200 },
  { text: '', delay: 100 },
  { text: '"The world ended, but the watch continues."', delay: 500 },
];

/**
 * Run the boot sequence
 * @returns {Promise}
 */
export async function bootSequence() {
  const logoElement = document.getElementById('boot-logo');
  const statusElement = document.getElementById('boot-status');
  const progressBar = document.getElementById('boot-bar');

  // Display logo with flicker
  logoElement.classList.add('boot-flicker');
  logoElement.textContent = LOGO;

  await delay(1000);

  // Show boot messages
  const totalMessages = BOOT_MESSAGES.length;

  for (let i = 0; i < totalMessages; i++) {
    const message = BOOT_MESSAGES[i];

    // Update status
    statusElement.textContent = message.text;

    // Update progress
    const progress = Math.round(((i + 1) / totalMessages) * 100);
    progressBar.style.width = `${progress}%`;

    // Random flicker effect
    if (Math.random() < 0.1) {
      statusElement.style.opacity = '0.5';
      await delay(50);
      statusElement.style.opacity = '1';
    }

    await delay(message.delay);
  }

  // Final flourish
  await delay(300);
  progressBar.style.width = '100%';

  await delay(500);

  // Fade out boot screen
  const bootScreen = document.getElementById('boot-screen');
  bootScreen.style.transition = 'opacity 0.5s';
  bootScreen.style.opacity = '0';

  await delay(500);
}

/**
 * Quick boot (skip animation)
 */
export async function quickBoot() {
  const bootScreen = document.getElementById('boot-screen');
  bootScreen.style.display = 'none';
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random hex noise
 */
export function generateHexNoise(lines = 3) {
  const result = [];

  for (let i = 0; i < lines; i++) {
    let line = '';
    const bytes = 16;

    // Address
    line += '0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0') + ': ';

    // Hex values
    for (let j = 0; j < bytes; j++) {
      line += Math.floor(Math.random() * 256).toString(16).padStart(2, '0') + ' ';
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * ASCII eye animation frames
 */
export const ASCII_EYE = {
  left: `
   .-"""-.
  /        \\
 |  O    O  |
 |    __    |
  \\        /
   '-.,,.-'
`,
  center: `
   .-"""-.
  /        \\
 |   O  O   |
 |    __    |
  \\        /
   '-.,,.-'
`,
  right: `
   .-"""-.
  /        \\
 |  O    O  |
 |    __    |
  \\        /
   '-.,,.-'
`,
  blink: `
   .-"""-.
  /        \\
 |  -    -  |
 |    __    |
  \\        /
   '-.,,.-'
`
};
