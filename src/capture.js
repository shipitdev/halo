/** Capture readable screen images without including Halo's overlay. */
const { desktopCapturer, screen, systemPreferences } = require('electron');

function selectDisplaySource(sources, displayId) {
  return sources.find(source => String(source.display_id) === String(displayId)) || null;
}

async function captureImage({ overlayWindow, maxWidth = 2560 } = {}) {
  if (process.platform === 'darwin') {
    const access = systemPreferences.getMediaAccessStatus('screen');
    if (access === 'denied' || access === 'restricted') {
      throw new Error('Screen Recording access is blocked. Enable Halo in System Settings > Privacy & Security > Screen Recording, then restart Halo.');
    }
  }
  const display = overlayWindow && !overlayWindow.isDestroyed()
    ? screen.getDisplayMatching(overlayWindow.getBounds()) : screen.getPrimaryDisplay();
  const restore = overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible();
  try {
    if (restore) {
      overlayWindow.hide();
      // Allow the window compositor to remove the overlay before taking a snapshot.
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    const width = Math.min(Math.round(display.size.width * display.scaleFactor), maxWidth);
    const height = Math.round(width * display.size.height / display.size.width);
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const source = selectDisplaySource(sources, display.id);
    if (!source || source.thumbnail.isEmpty()) throw new Error('No image was returned for the selected display.');
    return source.thumbnail;
  } catch (err) {
    throw new Error(`Screen capture failed: ${err.message}`);
  } finally {
    if (restore && !overlayWindow.isDestroyed()) overlayWindow.showInactive();
  }
}

async function captureScreen(options) {
  const image = await captureImage(options);
  return `data:image/png;base64,${image.toPNG().toString('base64')}`;
}

async function captureScreenBuffer(options) {
  return (await captureImage(options)).toPNG();
}

module.exports = { captureScreen, captureScreenBuffer, selectDisplaySource };
